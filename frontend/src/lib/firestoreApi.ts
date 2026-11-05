/**
 * Firestore data-access layer. This replaces the old FastAPI REST client --
 * every function here talks directly to Firestore/Storage from the browser
 * using the Firebase client SDK. Security (who can read/write what) is
 * enforced by firestore.rules / storage.rules at the project root, not by
 * any code in this file -- treat these functions as "the shapes of the
 * writes the UI wants to make", with the rules as the actual gatekeeper.
 *
 * Firestore has no free-text search and limited compound-query support, so
 * search/filter functions here fetch a reasonably-bounded candidate set
 * (e.g. all open projects) and filter in JS. That's fine at the scale a
 * student-project / small-community deployment runs at; a larger
 * deployment would want Algolia/Typesense fed by Firestore triggers.
 */
import {
  collection, collectionGroup, doc, getDoc, getDocs, query, where, orderBy, limit as qLimit,
  addDoc, updateDoc, deleteDoc, runTransaction, writeBatch, onSnapshot,
  serverTimestamp, Timestamp, arrayUnion, arrayRemove, type Unsubscribe, type DocumentData, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  UserProfile, ProjectSummary, ProjectDetail, Position, CollaborationRequestOut,
  RepositoryFile, FileVersion, ConversationOut, MessageOut, NotificationOut,
} from "../types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ms(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return 0;
}

function splitCsv(v?: string): string[] {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface ActingUser {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Users / collaborators (5.1, 5.3)
// ---------------------------------------------------------------------------

function userDocToProfile(id: string, data: DocumentData): UserProfile {
  const lastSeenAtMs = data.lastSeenAt instanceof Timestamp ? data.lastSeenAt.toMillis() : undefined;
  return {
    id,
    name: data.name || "",
    email: data.email || "",
    institution: data.institution ?? null,
    bio: data.bio ?? null,
    profilePictureUrl: data.profilePictureUrl ?? null,
    skills: data.skills || [],
    interests: data.interests || [],
    portfolioLinks: data.portfolioLinks || [],
    isOnline: !!lastSeenAtMs && Date.now() - lastSeenAtMs < 5 * 60 * 1000,
    lastSeenAtMs: lastSeenAtMs ?? null,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return userDocToProfile(snap.id, snap.data());
}

export interface EditProfilePayload {
  name?: string;
  bio?: string;
  institution?: string;
  profilePictureUrl?: string;
  skills?: string; // comma-separated as typed
  interests?: string;
  portfolioLinks?: string;
}

export async function editProfile(uid: string, payload: EditProfilePayload): Promise<void> {
  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name.trim();
  if (payload.bio !== undefined) data.bio = payload.bio;
  if (payload.institution !== undefined) data.institution = payload.institution;
  if (payload.profilePictureUrl !== undefined) data.profilePictureUrl = payload.profilePictureUrl;
  if (payload.skills !== undefined) data.skills = splitCsv(payload.skills);
  if (payload.interests !== undefined) data.interests = splitCsv(payload.interests);
  if (payload.portfolioLinks !== undefined) data.portfolioLinks = splitCsv(payload.portfolioLinks);
  await updateDoc(doc(db, "users", uid), data);
}

export interface CollaboratorFilters {
  q?: string;
  skill?: string;
  institution?: string;
  interest?: string;
}

export async function searchCollaborators(currentUid: string, filters: CollaboratorFilters): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "users"));
  const q = filters.q?.toLowerCase().trim();
  const skill = filters.skill?.toLowerCase().trim();
  const institution = filters.institution?.toLowerCase().trim();
  const interest = filters.interest?.toLowerCase().trim();

  return snap.docs
    .filter((d) => d.id !== currentUid)
    .map((d) => userDocToProfile(d.id, d.data()))
    .filter((u) => {
      if (q && !(u.name.toLowerCase().includes(q) || (u.bio || "").toLowerCase().includes(q))) return false;
      if (skill && !u.skills.some((s) => s.toLowerCase().includes(skill))) return false;
      if (institution && !(u.institution || "").toLowerCase().includes(institution)) return false;
      if (interest && !u.interests.some((s) => s.toLowerCase().includes(interest))) return false;
      return true;
    });
}

// ---------------------------------------------------------------------------
// Projects (5.2)
// ---------------------------------------------------------------------------

function projectDocToSummary(id: string, data: DocumentData, openPositionsCount: number): ProjectSummary {
  return {
    id,
    title: data.title,
    description: data.description,
    category: data.category ?? null,
    technologies: data.technologies || [],
    requiredSkills: data.requiredSkills || [],
    status: data.status,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    ownerProfilePictureUrl: data.ownerProfilePictureUrl ?? null,
    ownerInstitution: data.ownerInstitution ?? null,
    openPositionsCount,
    createdAtMs: ms(data.createdAt),
  };
}

async function countOpenPositions(projectId: string): Promise<number> {
  const snap = await getDocs(collection(db, "projects", projectId, "positions"));
  return snap.docs.filter((d) => !d.data().isFilled).length;
}

async function positionsFor(projectId: string): Promise<Position[]> {
  const snap = await getDocs(collection(db, "projects", projectId, "positions"));
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      roleName: v.roleName,
      isFilled: !!v.isFilled,
      filledByUserId: v.filledByUserId ?? null,
      filledByName: v.filledByName ?? null,
      filledByProfilePictureUrl: v.filledByProfilePictureUrl ?? null,
    };
  });
}

export interface ProjectCreatePayload {
  title: string;
  description: string;
  category?: string;
  technologies?: string; // comma-separated
  requiredSkills?: string; // comma-separated
  allowRequests: boolean;
  positions: string[]; // role names
}

export async function createProject(owner: UserProfile, payload: ProjectCreatePayload): Promise<string> {
  const projectRef = doc(collection(db, "projects"));
  const batch = writeBatch(db);

  // Allocated up front (doc() just reserves an id locally, no network call)
  // so its id can be denormalized onto the project doc below -- see
  // groupConversationId.
  const convoRef = doc(collection(db, "conversations"));

  batch.set(projectRef, {
    title: payload.title.trim(),
    description: payload.description,
    category: payload.category || null,
    technologies: splitCsv(payload.technologies),
    requiredSkills: splitCsv(payload.requiredSkills),
    status: "open",
    allowRequests: payload.allowRequests,
    ownerId: owner.id,
    ownerName: owner.name,
    ownerProfilePictureUrl: owner.profilePictureUrl || null,
    ownerInstitution: owner.institution || null,
    // Denormalized alongside `positions` so firestore.rules can check repo /
    // chat / position-write access with a single get() instead of a
    // subcollection query (which security rules can't do at all).
    memberIds: [owner.id],
    // Denormalized so finalizeAcceptance() can reach this project's group
    // chat by a direct document reference instead of a query. A *query*
    // against `conversations` (filtering projectId/isGroup) can never be
    // proven safe by Firestore's list-query rule validator, because the
    // `conversations` read rule checks `memberIds`, a field that query
    // doesn't filter on -- Firestore rejects the whole query as
    // "insufficient permissions" even when the actual matching document
    // would satisfy the rule. A direct update by id sidesteps that
    // entirely (see finalizeAcceptance).
    groupConversationId: convoRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const roleName of payload.positions) {
    if (!roleName.trim()) continue;
    const posRef = doc(collection(db, "projects", projectRef.id, "positions"));
    batch.set(posRef, { roleName: roleName.trim(), isFilled: false, filledByUserId: null, filledByName: null });
  }

  // Project group chat -- unlocked to new members as they're accepted.
  batch.set(convoRef, {
    isGroup: true,
    projectId: projectRef.id,
    projectTitle: payload.title.trim(),
    memberIds: [owner.id],
    memberNames: { [owner.id]: owner.name },
    memberProfilePics: { [owner.id]: owner.profilePictureUrl || null },
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    typing: {},
    lastRead: {},
  });

  await batch.commit();
  return projectRef.id;
}

export interface ProjectFilters {
  q?: string;
  technology?: string;
  skill?: string;
  category?: string;
  institution?: string;
  openPositionsOnly?: boolean;
}

export async function searchProjects(filters: ProjectFilters): Promise<ProjectSummary[]> {
  const base = collection(db, "projects");
  const snap = filters.openPositionsOnly === false
    ? await getDocs(query(base, orderBy("createdAt", "desc")))
    : await getDocs(query(base, where("status", "==", "open"), orderBy("createdAt", "desc")));

  const q = filters.q?.toLowerCase().trim();
  const technology = filters.technology?.toLowerCase().trim();
  const skill = filters.skill?.toLowerCase().trim();
  const category = filters.category?.toLowerCase().trim();
  const institution = filters.institution?.toLowerCase().trim();

  const withCounts = await Promise.all(
    snap.docs.map(async (d) => projectDocToSummary(d.id, d.data(), await countOpenPositions(d.id)))
  );

  return withCounts.filter((p) => {
    if (q && !(p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))) return false;
    if (technology && !p.technologies.some((t) => t.toLowerCase().includes(technology))) return false;
    if (skill && !p.requiredSkills.some((t) => t.toLowerCase().includes(skill))) return false;
    if (category && !(p.category || "").toLowerCase().includes(category)) return false;
    // ownerInstitution is denormalized onto the project doc at creation time
    // (see createProject) from the owner's profile at that moment, so it can
    // go stale if the owner edits their institution later -- acceptable
    // tradeoff to avoid an extra per-project profile read here.
    if (institution && !(p.ownerInstitution || "").toLowerCase().includes(institution)) return false;
    return true;
  });
}

export async function getRecentProjects(take = 10): Promise<ProjectSummary[]> {
  const snap = await getDocs(query(collection(db, "projects"), where("status", "==", "open"), orderBy("createdAt", "desc"), qLimit(take)));
  return Promise.all(snap.docs.map(async (d) => projectDocToSummary(d.id, d.data(), await countOpenPositions(d.id))));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const snap = await getDoc(doc(db, "projects", id));
  if (!snap.exists()) return null;
  const positions = await positionsFor(id);
  const summary = projectDocToSummary(id, snap.data(), positions.filter((p) => !p.isFilled).length);
  return {
    ...summary,
    positions,
    allowRequests: !!snap.data().allowRequests,
    teamMembers: positions
      .filter((p) => p.filledByUserId)
      .map((p) => ({ id: p.filledByUserId as string, name: p.filledByName || "", profilePictureUrl: p.filledByProfilePictureUrl })),
  };
}

export async function getUserOwnedProjects(uid: string): Promise<ProjectSummary[]> {
  const snap = await getDocs(query(collection(db, "projects"), where("ownerId", "==", uid), orderBy("createdAt", "desc")));
  return Promise.all(snap.docs.map(async (d) => projectDocToSummary(d.id, d.data(), await countOpenPositions(d.id))));
}

export async function getUserCollaborations(uid: string): Promise<ProjectSummary[]> {
  const positionsSnap = await getDocs(query(collectionGroup(db, "positions"), where("filledByUserId", "==", uid)));
  const projectIds = Array.from(new Set(positionsSnap.docs.map((d) => d.ref.parent.parent!.id)));
  const projects = await Promise.all(projectIds.map((id) => getProject(id)));
  return projects.filter((p): p is ProjectDetail => !!p);
}

export interface ProjectUpdatePayload {
  title?: string;
  description?: string;
  category?: string;
  technologies?: string;
  requiredSkills?: string;
  allowRequests?: boolean;
}

export async function updateProject(id: string, payload: ProjectUpdatePayload): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (payload.title !== undefined) data.title = payload.title;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.category !== undefined) data.category = payload.category;
  if (payload.technologies !== undefined) data.technologies = splitCsv(payload.technologies);
  if (payload.requiredSkills !== undefined) data.requiredSkills = splitCsv(payload.requiredSkills);
  if (payload.allowRequests !== undefined) data.allowRequests = payload.allowRequests;
  await updateDoc(doc(db, "projects", id), data);
}

export async function removeCollaborator(projectId: string, positionId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const posRef = doc(db, "projects", projectId, "positions", positionId);
    const posSnap = await tx.get(posRef);
    if (!posSnap.exists() || !posSnap.data().isFilled) throw new Error("This position does not have an active collaborator.");
    const removedUserId = posSnap.data().filledByUserId as string;

    tx.update(posRef, { isFilled: false, filledByUserId: null, filledByName: null, filledByProfilePictureUrl: null });
    // Removing a collaborator always frees up the position we just updated,
    // so the project always has at least one open position again.
    tx.update(doc(db, "projects", projectId), { status: "open", memberIds: arrayRemove(removedUserId) });

    const notifRef = doc(collection(db, "notifications"));
    tx.set(notifRef, {
      userId: removedUserId,
      type: "removed_from_project",
      message: "You have been removed from a project.",
      data: { projectId },
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });
}

// ---------------------------------------------------------------------------
// Collaboration requests (5.2 REQ-4, 5.3 REQ-3)
// ---------------------------------------------------------------------------

function requestDocToOut(id: string, data: DocumentData): CollaborationRequestOut {
  return {
    id,
    projectId: data.projectId,
    projectTitle: data.projectTitle,
    positionId: data.positionId ?? null,
    positionRole: data.positionRole ?? null,
    requesterId: data.requesterId,
    requesterName: data.requesterName,
    requesterProfilePictureUrl: data.requesterProfilePictureUrl ?? null,
    initiatedById: data.initiatedById,
    ownerId: data.ownerId,
    direction: data.direction,
    status: data.status,
    message: data.message ?? null,
    createdAtMs: ms(data.createdAt),
  };
}

export async function requestToJoin(project: ProjectDetail, requester: ActingUser, positionId: string | null, message: string) {
  if (!project.allowRequests) throw new Error("The project owner has disabled collaboration requests.");
  if (project.ownerId === requester.id) throw new Error("You cannot request to join your own project.");
  if (project.teamMembers.some((m) => m.id === requester.id)) throw new Error("You are already a collaborator in this project.");

  const existing = await getDocs(query(
    collection(db, "collaborationRequests"),
    where("projectId", "==", project.id),
    where("requesterId", "==", requester.id),
    where("status", "==", "pending"),
  ));
  if (!existing.empty) throw new Error("You have already submitted a request for this project.");

  let positionRole: string | null = null;
  if (positionId) {
    const pos = project.positions.find((p) => p.id === positionId);
    if (!pos) throw new Error("The selected role could not be found.");
    if (pos.isFilled) throw new Error("The selected role has already been filled.");
    positionRole = pos.roleName;
  }

  const reqRef = await addDoc(collection(db, "collaborationRequests"), {
    projectId: project.id,
    projectTitle: project.title,
    positionId: positionId || null,
    positionRole,
    requesterId: requester.id,
    requesterName: requester.name,
    requesterProfilePictureUrl: requester.profilePictureUrl || null,
    initiatedById: requester.id,
    ownerId: project.ownerId,
    direction: "join_request",
    status: "pending",
    message: message || null,
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "notifications"), {
    userId: project.ownerId,
    type: "collab_request_received",
    message: `${requester.name} requested to join "${project.title}".`,
    data: { projectId: project.id, requestId: reqRef.id },
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function inviteCollaborator(project: ProjectDetail, inviter: ActingUser, collaborator: UserProfile, positionId: string | null, message: string) {
  if (project.ownerId !== inviter.id) throw new Error("Only the project owner may invite collaborators to this project.");
  if (project.teamMembers.some((m) => m.id === collaborator.id)) throw new Error("This user is already a collaborator in the selected project.");

  // Filtered on ownerId (== inviter.id, already checked above to be the
  // caller) rather than requesterId==collaborator.id: inviter.id is the only
  // value here that's provably equal to request.auth.uid from the query's
  // own filters, which is what the collaborationRequests read rule needs to
  // allow this *list* query at all (see the read-rule split in
  // firestore.rules, and the long comment on this exact issue in
  // finalizeAcceptance below). Filtering by projectId+requesterId directly
  // -- the "obvious" query -- is for an arbitrary collaborator.id the owner
  // is not provably related to from the filters alone, so Firestore
  // rejects it outright with "Missing or insufficient permissions."
  const existing = await getDocs(query(
    collection(db, "collaborationRequests"),
    where("projectId", "==", project.id),
    where("ownerId", "==", inviter.id),
    where("status", "==", "pending"),
  ));
  if (existing.docs.some((d) => d.data().requesterId === collaborator.id)) {
    throw new Error("This user has already been invited.");
  }

  let positionRole: string | null = null;
  if (positionId) {
    const pos = project.positions.find((p) => p.id === positionId);
    if (!pos) throw new Error("The selected role could not be found.");
    if (pos.isFilled) throw new Error("The selected project role has already been filled.");
    positionRole = pos.roleName;
  } else if (!project.positions.some((p) => !p.isFilled)) {
    throw new Error("The selected project has no open positions.");
  }

  const reqRef = await addDoc(collection(db, "collaborationRequests"), {
    projectId: project.id,
    projectTitle: project.title,
    positionId: positionId || null,
    positionRole,
    requesterId: collaborator.id,
    requesterName: collaborator.name,
    requesterProfilePictureUrl: collaborator.profilePictureUrl || null,
    initiatedById: inviter.id,
    ownerId: project.ownerId,
    direction: "invitation",
    status: "pending",
    message: message || null,
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "notifications"), {
    userId: collaborator.id,
    type: "invitation_received",
    message: `${inviter.name} invited you to join "${project.title}".`,
    data: { projectId: project.id, requestId: reqRef.id },
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function getIncomingRequests(ownerId: string): Promise<CollaborationRequestOut[]> {
  const snap = await getDocs(query(
    collection(db, "collaborationRequests"),
    where("ownerId", "==", ownerId),
    where("direction", "==", "join_request"),
    where("status", "==", "pending"),
  ));
  return snap.docs.map((d) => requestDocToOut(d.id, d.data())).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function getMyInvitations(uid: string): Promise<CollaborationRequestOut[]> {
  const snap = await getDocs(query(
    collection(db, "collaborationRequests"),
    where("requesterId", "==", uid),
    where("direction", "==", "invitation"),
    where("status", "==", "pending"),
  ));
  return snap.docs.map((d) => requestDocToOut(d.id, d.data())).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

async function finalizeAcceptance(requestId: string) {
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, "collaborationRequests", requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("This request no longer exists.");
    const reqData = reqSnap.data();
    if (reqData.status !== "pending") throw new Error("This request has already been responded to.");

    const projectRef = doc(db, "projects", reqData.projectId);
    const projectSnap = await tx.get(projectRef);
    if (!projectSnap.exists()) throw new Error("This project no longer exists.");
    const positionsSnap = await getDocs(collection(db, "projects", reqData.projectId, "positions"));

    let positionDocId: string | null = reqData.positionId || null;
    if (!positionDocId) {
      const open = positionsSnap.docs.find((d) => !d.data().isFilled);
      if (!open) throw new Error("There are no open positions left on this project.");
      positionDocId = open.id;
    }
    const posSnap = positionsSnap.docs.find((d) => d.id === positionDocId);
    if (!posSnap) throw new Error("The selected role could not be found.");
    if (posSnap.data().isFilled) throw new Error("The selected role has already been filled.");

    tx.update(doc(db, "projects", reqData.projectId, "positions", positionDocId), {
      isFilled: true,
      filledByUserId: reqData.requesterId,
      filledByName: reqData.requesterName,
      filledByProfilePictureUrl: reqData.requesterProfilePictureUrl || null,
    });

    const stillOpenAfter = positionsSnap.docs.some((d) => d.id !== positionDocId && !d.data().isFilled);
    tx.update(projectRef, { status: stillOpenAfter ? "open" : "full", memberIds: arrayUnion(reqData.requesterId) });

    tx.update(reqRef, { status: "accepted", respondedAt: serverTimestamp() });

    // Unlock the project's group chat for the new collaborator.
    //
    // This used to be a getDocs(query(... where projectId ..., where
    // isGroup ...)) lookup against the `conversations` collection. Firestore
    // validates a *list* query against security rules using only the
    // query's own filters -- it rejects the whole query as "Missing or
    // insufficient permissions" unless every field the read rule depends on
    // is itself constrained by the query, regardless of whether the actual
    // matching document would satisfy the rule for this caller. The
    // `conversations` read rule checks `memberIds`, which that query never
    // filtered on, so it was rejected on *every* call to this function --
    // including a project owner accepting an incoming join request, even
    // though the owner was already a member of that exact chat.
    //
    // Projects now carry their chat's id directly (`groupConversationId`,
    // set in createProject), so we go straight to a direct-reference
    // update instead. A direct update by a known id only has to satisfy the
    // `allow update` rule -- which already has a TRUST BOUNDARY clause
    // covering exactly "add the caller's own uid to a group chat's
    // memberIds" -- and never needs a separate "read" grant, so this works
    // both for an owner accepting a join request (already a member) and a
    // requester accepting an invitation (not yet a member).
    const groupConversationId: string | undefined = projectSnap.data()?.groupConversationId;
    if (groupConversationId) {
      tx.update(doc(db, "conversations", groupConversationId), {
        memberIds: arrayUnion(reqData.requesterId),
        [`memberNames.${reqData.requesterId}`]: reqData.requesterName,
        [`memberProfilePics.${reqData.requesterId}`]: reqData.requesterProfilePictureUrl || null,
      });
    }
    // Projects created before this field existed have no known chat id --
    // skip unlocking chat access for them rather than falling back to the
    // permission-rejected query above.

    const notifyTarget = reqData.direction === "join_request" ? reqData.requesterId : reqData.ownerId;
    const notifRef = doc(collection(db, "notifications"));
    tx.set(notifRef, {
      userId: notifyTarget,
      type: "request_accepted",
      message: `Your collaboration on "${reqData.projectTitle}" was accepted.`,
      data: { projectId: reqData.projectId },
      isRead: false,
      createdAt: serverTimestamp(),
    });

    const addedNotifRef = doc(collection(db, "notifications"));
    tx.set(addedNotifRef, {
      userId: reqData.requesterId,
      type: "added_to_project",
      message: `You've been added to "${reqData.projectTitle}". The repository and project chat are now unlocked.`,
      data: { projectId: reqData.projectId },
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function acceptRequest(requestId: string): Promise<void> {
  await finalizeAcceptance(requestId);
}

export async function rejectRequest(requestId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, "collaborationRequests", requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("This request no longer exists.");
    const reqData = reqSnap.data();
    if (reqData.status !== "pending") throw new Error("This request has already been responded to.");

    tx.update(reqRef, { status: "rejected", respondedAt: serverTimestamp() });

    const notifyTarget = reqData.direction === "join_request" ? reqData.requesterId : reqData.ownerId;
    const notifRef = doc(collection(db, "notifications"));
    tx.set(notifRef, {
      userId: notifyTarget,
      type: "request_rejected",
      message: `A collaboration request on "${reqData.projectTitle}" was declined.`,
      data: { projectId: reqData.projectId },
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });
}

// ---------------------------------------------------------------------------
// Recommendations (5.6) -- plain client-side overlap scoring, no backend/ML
// ---------------------------------------------------------------------------

function overlapScore(a: string[], b: string[]): number {
  const bSet = new Set(b.map((s) => s.toLowerCase()));
  return a.reduce((acc, s) => acc + (bSet.has(s.toLowerCase()) ? 1 : 0), 0);
}

export async function recommendProjectsForUser(user: UserProfile, take = 10): Promise<ProjectSummary[]> {
  const mySkills = [...user.skills, ...user.interests];
  const projects = await getRecentProjects(50);
  const candidates = projects.filter((p) => p.ownerId !== user.id);
  const scored = candidates.map((p) => ({ p, score: overlapScore(mySkills, [...p.requiredSkills, ...p.technologies]) }));
  const withMatches = scored.filter((s) => s.score > 0);
  if (mySkills.length === 0 || withMatches.length === 0) {
    return candidates.sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, take);
  }
  return withMatches.sort((a, b) => b.score - a.score).map((s) => s.p).slice(0, take);
}

export async function recommendCollaboratorsForProject(project: ProjectDetail, take = 10): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "users"));
  const required = [...project.requiredSkills, ...project.technologies];
  const existingIds = new Set(project.teamMembers.map((m) => m.id));
  const scored = snap.docs
    .filter((d) => d.id !== project.ownerId && !existingIds.has(d.id))
    .map((d) => userDocToProfile(d.id, d.data()))
    .map((u) => ({ u, score: overlapScore(required, [...u.skills, ...u.interests]) }))
    .filter((s) => s.score > 0);
  return scored.sort((a, b) => b.score - a.score).map((s) => s.u).slice(0, take);
}

// ---------------------------------------------------------------------------
// Repository (5.4) -- Firebase Storage for bytes, Firestore for metadata
// ---------------------------------------------------------------------------

function versionDocToOut(id: string, data: DocumentData): FileVersion {
  return {
    id,
    versionNumber: data.versionNumber,
    sizeBytes: data.sizeBytes,
    contentType: data.contentType ?? null,
    contributorId: data.contributorId,
    contributorName: data.contributorName,
    storagePath: data.storagePath,
    uploadedAtMs: ms(data.uploadedAt),
  };
}

export async function listRepoFiles(projectId: string): Promise<RepositoryFile[]> {
  const filesSnap = await getDocs(collection(db, "projects", projectId, "repoFiles"));
  const out: RepositoryFile[] = [];
  for (const fileDoc of filesSnap.docs) {
    const versionsSnap = await getDocs(query(collection(db, "projects", projectId, "repoFiles", fileDoc.id, "versions"), orderBy("versionNumber", "asc")));
    const versions = versionsSnap.docs.map((v) => versionDocToOut(v.id, v.data()));
    out.push({
      id: fileDoc.id,
      path: fileDoc.data().path,
      updatedAtMs: ms(fileDoc.data().updatedAt),
      latestVersion: versions[versions.length - 1] || null,
      versions: [...versions].reverse(),
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  "py", "js", "ts", "tsx", "jsx", "json", "md", "txt", "css", "html",
  "yml", "yaml", "java", "c", "cpp", "h", "go", "rb", "php", "sql",
  "png", "jpg", "jpeg", "gif", "svg", "pdf", "csv", "xlsx", "zip",
  "ipynb", "xml", "sh",
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function uploadRepoFile(projectId: string, path: string, file: File, contributor: ActingUser): Promise<string> {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (ext && !ALLOWED_UPLOAD_EXTENSIONS.has(ext)) throw new Error(`Unsupported file type: .${ext}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File size exceeds the 25MB limit.");

  const filesSnap = await getDocs(query(collection(db, "projects", projectId, "repoFiles"), where("path", "==", path)));
  let fileId = filesSnap.docs[0]?.id;
  if (!fileId) {
    const newFileRef = await addDoc(collection(db, "projects", projectId, "repoFiles"), {
      path, updatedAt: serverTimestamp(), latestVersionNumber: 0,
    });
    fileId = newFileRef.id;
  }

  const versionsSnap = await getDocs(collection(db, "projects", projectId, "repoFiles", fileId, "versions"));
  const versionNumber = versionsSnap.size + 1;
  const storagePath = `repositories/${projectId}/${fileId}/v${versionNumber}__${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });

  await addDoc(collection(db, "projects", projectId, "repoFiles", fileId, "versions"), {
    versionNumber,
    storagePath,
    sizeBytes: file.size,
    contentType: file.type || null,
    contributorId: contributor.id,
    contributorName: contributor.name,
    uploadedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "projects", projectId, "repoFiles", fileId), { updatedAt: serverTimestamp(), latestVersionNumber: versionNumber });

  return fileId;
}

export async function updateRepoFileContent(projectId: string, fileId: string, path: string, content: string, contributor: ActingUser): Promise<void> {
  const versionsSnap = await getDocs(collection(db, "projects", projectId, "repoFiles", fileId, "versions"));
  const versionNumber = versionsSnap.size + 1;
  const storagePath = `repositories/${projectId}/${fileId}/v${versionNumber}__${path.split("/").pop()}`;
  const storageRef = ref(storage, storagePath);
  const bytes = new TextEncoder().encode(content);
  await uploadBytes(storageRef, bytes, { contentType: "text/plain" });

  await addDoc(collection(db, "projects", projectId, "repoFiles", fileId, "versions"), {
    versionNumber,
    storagePath,
    sizeBytes: bytes.byteLength,
    contentType: "text/plain",
    contributorId: contributor.id,
    contributorName: contributor.name,
    uploadedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "projects", projectId, "repoFiles", fileId), { updatedAt: serverTimestamp(), latestVersionNumber: versionNumber });
}

export async function getRepoFileDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

export async function getRepoFileTextContent(storagePath: string): Promise<string> {
  const url = await getRepoFileDownloadUrl(storagePath);
  const res = await fetch(url);
  return res.text();
}

export async function deleteRepoFile(projectId: string, fileId: string): Promise<void> {
  const versionsSnap = await getDocs(collection(db, "projects", projectId, "repoFiles", fileId, "versions"));
  await Promise.all(versionsSnap.docs.map((v) => deleteObject(ref(storage, v.data().storagePath)).catch(() => {})));
  await Promise.all(versionsSnap.docs.map((v) => deleteDoc(v.ref)));
  await deleteDoc(doc(db, "projects", projectId, "repoFiles", fileId));
}

// ---------------------------------------------------------------------------
// Chat (5.5) -- realtime via onSnapshot instead of Socket.IO
// ---------------------------------------------------------------------------

function conversationDocToOut(id: string, data: DocumentData, uid: string): ConversationOut {
  const lastRead = data.lastRead?.[uid];
  const lastReadMs = lastRead instanceof Timestamp ? lastRead.toMillis() : 0;
  const lastMessageAtMs = data.lastMessage ? ms(data.lastMessage.createdAt) : 0;
  const unread = data.lastMessage && data.lastMessage.senderId !== uid && lastMessageAtMs > lastReadMs ? 1 : 0;
  return {
    id,
    isGroup: !!data.isGroup,
    projectId: data.projectId ?? null,
    projectTitle: data.projectTitle ?? null,
    memberIds: data.memberIds || [],
    memberNames: data.memberNames || {},
    memberProfilePics: data.memberProfilePics || {},
    lastMessageBody: data.lastMessage?.body ?? null,
    lastMessageSenderId: data.lastMessage?.senderId ?? null,
    lastMessageAtMs: lastMessageAtMs || null,
    unreadCount: unread,
  };
}

export function subscribeToConversations(uid: string, onChange: (convos: ConversationOut[]) => void): Unsubscribe {
  const q = query(collection(db, "conversations"), where("memberIds", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => conversationDocToOut(d.id, d.data(), uid));
    list.sort((a, b) => (b.lastMessageAtMs || 0) - (a.lastMessageAtMs || 0));
    onChange(list);
  });
}

export function subscribeToMessages(conversationId: string, onChange: (messages: MessageOut[]) => void): Unsubscribe {
  const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        conversationId,
        senderId: v.senderId,
        senderName: v.senderName,
        senderProfilePictureUrl: v.senderProfilePictureUrl ?? null,
        body: v.body ?? null,
        createdAtMs: ms(v.createdAt),
      };
    }));
  });
}

export function subscribeToTyping(conversationId: string, onChange: (typingUserIds: string[]) => void): Unsubscribe {
  return onSnapshot(doc(db, "conversations", conversationId), (snap) => {
    const typing = snap.data()?.typing || {};
    const now = Date.now();
    const active = Object.entries(typing as Record<string, Timestamp>)
      .filter(([, ts]) => ts && now - ts.toMillis() < 4000)
      .map(([uid]) => uid);
    onChange(active);
  });
}

export async function setTyping(conversationId: string, uid: string, isTyping: boolean): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), {
    [`typing.${uid}`]: isTyping ? serverTimestamp() : null,
  });
}

export async function openOrCreateDirectConversation(current: ActingUser, other: UserProfile): Promise<string> {
  const existingSnap = await getDocs(query(
    collection(db, "conversations"),
    where("isGroup", "==", false),
    where("memberIds", "array-contains", current.id),
  ));
  const match = existingSnap.docs.find((d) => {
    const ids: string[] = d.data().memberIds || [];
    return ids.length === 2 && ids.includes(other.id);
  });
  if (match) return match.id;

  const convoRef = await addDoc(collection(db, "conversations"), {
    isGroup: false,
    projectId: null,
    projectTitle: null,
    memberIds: [current.id, other.id],
    memberNames: { [current.id]: current.name, [other.id]: other.name },
    memberProfilePics: { [current.id]: current.profilePictureUrl || null, [other.id]: other.profilePictureUrl || null },
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    typing: {},
    lastRead: {},
  });
  return convoRef.id;
}

export async function getProjectGroupConversationId(projectId: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, "conversations"), where("projectId", "==", projectId), where("isGroup", "==", true)));
  return snap.docs[0]?.id || null;
}

export async function sendMessage(conversationId: string, sender: ActingUser, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId: sender.id,
    senderName: sender.name,
    senderProfilePictureUrl: sender.profilePictureUrl || null,
    body: trimmed,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: { body: trimmed, senderId: sender.id, createdAt: serverTimestamp() },
    lastMessageAt: serverTimestamp(),
    [`typing.${sender.id}`]: null,
  });

  const convoSnap = await getDoc(doc(db, "conversations", conversationId));
  const memberIds: string[] = convoSnap.data()?.memberIds || [];
  await Promise.all(memberIds.filter((id) => id !== sender.id).map((id) =>
    addDoc(collection(db, "notifications"), {
      userId: id,
      type: "new_message",
      message: `New message from ${sender.name}`,
      data: { conversationId },
      isRead: false,
      createdAt: serverTimestamp(),
    })
  ));
}

export async function markConversationRead(conversationId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { [`lastRead.${uid}`]: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function notificationDocToOut(id: string, data: DocumentData): NotificationOut {
  return {
    id,
    type: data.type,
    message: data.message,
    data: data.data ?? null,
    isRead: !!data.isRead,
    createdAtMs: ms(data.createdAt),
  };
}

export function subscribeToNotifications(uid: string, onChange: (notifications: NotificationOut[]) => void): Unsubscribe {
  const q = query(collection(db, "notifications"), where("userId", "==", uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => notificationDocToOut(d.id, d.data()))));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { isRead: true });
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notifications", id), { isRead: true }));
  await batch.commit();
}

export async function clearNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, "notifications", id));
}

export type { QueryDocumentSnapshot };

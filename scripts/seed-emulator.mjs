/**
 * Seeds the Firebase Local Emulator Suite with the same demo accounts /
 * sample data the original FastAPI build shipped with `python -m app.seed`.
 *
 * Usage (with the emulators already running in another terminal --
 * `npm run emulators` from the repo root, or `firebase emulators:start
 * --project demo-collabcupid`):
 *
 *   cd scripts
 *   npm install
 *   npm run seed
 *
 * This ONLY ever talks to the emulators (it points firebase-admin at
 * localhost via the *_EMULATOR_HOST env vars below) -- it never touches a
 * real Firebase project, and needs no credentials or service account key.
 * Safe to re-run: it skips any demo user that already exists.
 */
process.env.FIRESTORE_EMULATOR_HOST ||= "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "localhost:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "localhost:9199";

import admin from "firebase-admin";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "demo-collabcupid";
const DEMO_PASSWORD = "Passw0rd!";

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const USERS = [
  {
    key: "johanna", name: "Johanna Joyce", email: "johanna@college.edu",
    institution: "State College", bio: "CS junior, building things that matter.",
    skills: ["React", "Node.js", "Figma"], interests: ["AI", "Hackathons"],
  },
  {
    key: "aiden", name: "Aiden Park", email: "aiden@university.edu",
    institution: "Tech University", bio: "Backend-leaning full-stack dev.",
    skills: ["Python", "PostgreSQL", "Docker"], interests: ["AI", "Open Source"],
  },
  {
    key: "maria", name: "Maria Santos", email: "maria@techinstitute.edu",
    institution: "Tech Institute", bio: "Sustainability + software.",
    skills: ["React", "Data Viz", "Python"], interests: ["Climate", "Design"],
  },
  {
    key: "raj", name: "Raj Patel", email: "raj@college.edu",
    institution: "State College", bio: "Mobile dev, always looking for a team.",
    skills: ["Swift", "Kotlin", "Figma"], interests: ["Mobile", "Hackathons"],
  },
];

async function ensureUser(spec) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(spec.email);
    uid = existing.uid;
    console.log(`  - ${spec.email} already exists (${uid}), skipping create`);
  } catch {
    const created = await auth.createUser({
      email: spec.email, password: DEMO_PASSWORD, displayName: spec.name, emailVerified: true,
    });
    uid = created.uid;
    await db.collection("users").doc(uid).set({
      name: spec.name,
      email: spec.email,
      institution: spec.institution,
      bio: spec.bio,
      profilePictureUrl: null,
      skills: spec.skills,
      interests: spec.interests,
      portfolioLinks: [],
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    });
    console.log(`  - created ${spec.email} (${uid})`);
  }
  return uid;
}

async function main() {
  console.log(`Seeding emulator data for project "${PROJECT_ID}"...`);
  console.log("Creating demo accounts (all use password: " + DEMO_PASSWORD + ")");
  const uids = {};
  for (const spec of USERS) {
    uids[spec.key] = await ensureUser(spec);
  }

  const existingProjects = await db.collection("projects").limit(1).get();
  if (!existingProjects.empty) {
    console.log("Projects already exist -- skipping sample project creation.");
    console.log("Done.");
    return;
  }

  console.log("Creating sample projects...");

  // "CollabCupid" -- owned by Johanna, Aiden already on the team, one open
  // role, and Raj has a pending join request waiting on it.
  const collabRef = db.collection("projects").doc();
  await collabRef.set({
    title: "CollabCupid",
    description: "A platform for students to find project partners and manage team collaboration end to end.",
    category: "Web Development",
    technologies: ["React", "TypeScript", "Firebase"],
    requiredSkills: ["React", "Node.js", "UI Design"],
    status: "open",
    allowRequests: true,
    ownerId: uids.johanna,
    ownerName: "Johanna Joyce",
    ownerProfilePictureUrl: null,
    ownerInstitution: "State College",
    memberIds: [uids.johanna, uids.aiden],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const collabPositions = collabRef.collection("positions");
  await collabPositions.add({ roleName: "Backend Developer", isFilled: true, filledByUserId: uids.aiden, filledByName: "Aiden Park", filledByProfilePictureUrl: null });
  await collabPositions.add({ roleName: "UI/UX Designer", isFilled: false, filledByUserId: null, filledByName: null, filledByProfilePictureUrl: null });

  const collabConvo = db.collection("conversations").doc();
  await collabConvo.set({
    isGroup: true, projectId: collabRef.id, projectTitle: "CollabCupid",
    memberIds: [uids.johanna, uids.aiden],
    memberNames: { [uids.johanna]: "Johanna Joyce", [uids.aiden]: "Aiden Park" },
    memberProfilePics: { [uids.johanna]: null, [uids.aiden]: null },
    createdAt: FieldValue.serverTimestamp(), lastMessageAt: FieldValue.serverTimestamp(),
    typing: {}, lastRead: {},
  });

  // "EcoTrack" -- owned by Maria, fully open, Raj's pending request lives here.
  const ecoRef = db.collection("projects").doc();
  await ecoRef.set({
    title: "EcoTrack",
    description: "Track your household's carbon footprint with friendly nudges and weekly challenges.",
    category: "Sustainability",
    technologies: ["React", "Python", "Chart.js"],
    requiredSkills: ["Data Viz", "Python", "Mobile"],
    status: "open",
    allowRequests: true,
    ownerId: uids.maria,
    ownerName: "Maria Santos",
    ownerProfilePictureUrl: null,
    ownerInstitution: "Tech Institute",
    memberIds: [uids.maria],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const ecoPositions = ecoRef.collection("positions");
  const mobileRoleRef = await ecoPositions.add({ roleName: "Mobile Developer", isFilled: false, filledByUserId: null, filledByName: null, filledByProfilePictureUrl: null });
  await ecoPositions.add({ roleName: "Data Analyst", isFilled: false, filledByUserId: null, filledByName: null, filledByProfilePictureUrl: null });

  await db.collection("conversations").add({
    isGroup: true, projectId: ecoRef.id, projectTitle: "EcoTrack",
    memberIds: [uids.maria],
    memberNames: { [uids.maria]: "Maria Santos" },
    memberProfilePics: { [uids.maria]: null },
    createdAt: FieldValue.serverTimestamp(), lastMessageAt: FieldValue.serverTimestamp(),
    typing: {}, lastRead: {},
  });

  await db.collection("collaborationRequests").add({
    projectId: ecoRef.id,
    projectTitle: "EcoTrack",
    positionId: mobileRoleRef.id,
    positionRole: "Mobile Developer",
    requesterId: uids.raj,
    requesterName: "Raj Patel",
    requesterProfilePictureUrl: null,
    initiatedById: uids.raj,
    ownerId: uids.maria,
    direction: "join_request",
    status: "pending",
    message: "I've shipped two React Native apps and would love to help with the mobile side!",
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("Done. Demo logins (password for all: " + DEMO_PASSWORD + "):");
  for (const spec of USERS) console.log(`  - ${spec.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

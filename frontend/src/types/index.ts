// Firestore collections used by this app:
//   users/{uid}
//   projects/{projectId}
//   projects/{projectId}/positions/{positionId}
//   projects/{projectId}/repoFiles/{fileId}
//   projects/{projectId}/repoFiles/{fileId}/versions/{versionId}
//   collaborationRequests/{requestId}
//   conversations/{conversationId}
//   conversations/{conversationId}/messages/{messageId}
//   notifications/{notificationId}
// See README-FIREBASE.md for the full schema write-up.

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  institution?: string | null;
  bio?: string | null;
  profilePictureUrl?: string | null;
  skills: string[];
  interests: string[];
  portfolioLinks: string[];
  isOnline: boolean; // derived client-side from lastSeenAt
  lastSeenAtMs?: number | null;
}

export interface Position {
  id: string;
  roleName: string;
  isFilled: boolean;
  filledByUserId?: string | null;
  filledByName?: string | null;
  filledByProfilePictureUrl?: string | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  technologies: string[];
  requiredSkills: string[];
  status: "open" | "full";
  ownerId: string;
  ownerName: string;
  ownerProfilePictureUrl?: string | null;
  ownerInstitution?: string | null;
  openPositionsCount: number;
  createdAtMs: number;
}

export interface ProjectDetail extends ProjectSummary {
  positions: Position[];
  allowRequests: boolean;
  teamMembers: { id: string; name: string; profilePictureUrl?: string | null }[];
}

export interface CollaborationRequestOut {
  id: string;
  projectId: string;
  projectTitle: string;
  positionId?: string | null;
  positionRole?: string | null;
  requesterId: string;
  requesterName: string;
  requesterProfilePictureUrl?: string | null;
  initiatedById: string;
  ownerId: string;
  direction: "join_request" | "invitation";
  status: "pending" | "accepted" | "rejected";
  message?: string | null;
  createdAtMs: number;
}

export interface FileVersion {
  id: string;
  versionNumber: number;
  sizeBytes: number;
  contentType?: string | null;
  contributorId: string;
  contributorName: string;
  storagePath: string;
  uploadedAtMs: number;
}

export interface RepositoryFile {
  id: string;
  path: string;
  updatedAtMs: number;
  latestVersion?: FileVersion | null;
  versions: FileVersion[];
}

export interface MessageOut {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderProfilePictureUrl?: string | null;
  body?: string | null;
  createdAtMs: number;
}

export interface ConversationOut {
  id: string;
  isGroup: boolean;
  projectId?: string | null;
  projectTitle?: string | null;
  memberIds: string[];
  memberNames: Record<string, string>;
  memberProfilePics?: Record<string, string | null>;
  lastMessageBody?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageAtMs?: number | null;
  unreadCount: number;
}

export interface NotificationOut {
  id: string;
  type: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAtMs: number;
}

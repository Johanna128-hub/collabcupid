import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile } from "../types";

interface AuthContextValue {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateLocalUser: (patch: Partial<UserProfile>) => void;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  institution?: string;
  skills?: string; // comma-separated, as typed in the form
  interests?: string;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 20 * 1000;

function splitCsv(v?: string): string[] {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function toMillis(ts: unknown): number | undefined {
  if (ts instanceof Timestamp) return ts.toMillis();
  return undefined;
}

function docToProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const lastSeenAtMs = toMillis(data.lastSeenAt);
  return {
    id: uid,
    name: (data.name as string) || "",
    email: (data.email as string) || "",
    institution: (data.institution as string) ?? null,
    bio: (data.bio as string) ?? null,
    profilePictureUrl: (data.profilePictureUrl as string) ?? null,
    skills: (data.skills as string[]) || [],
    interests: (data.interests as string[]) || [],
    portfolioLinks: (data.portfolioLinks as string[]) || [],
    isOnline: !!lastSeenAtMs && Date.now() - lastSeenAtMs < ONLINE_WINDOW_MS,
    lastSeenAtMs: lastSeenAtMs ?? null,
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const touchLastSeen = useCallback(async (uid: string) => {
    try {
      await updateDoc(doc(db, "users", uid), { lastSeenAt: serverTimestamp() });
    } catch {
      /* best-effort presence; ignore failures */
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        return;
      }
      const snap = await getDoc(doc(db, "users", fbUser.uid));
      if (snap.exists()) {
        setUser(docToProfile(fbUser.uid, snap.data()));
      }
      touchLastSeen(fbUser.uid);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => touchLastSeen(fbUser.uid), HEARTBEAT_MS);
      setLoading(false);
    });
    return () => {
      unsub();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [touchLastSeen]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    const profileDoc = {
      name: payload.name.trim(),
      email: payload.email.toLowerCase(),
      institution: payload.institution || null,
      bio: null,
      profilePictureUrl: null,
      skills: splitCsv(payload.skills),
      interests: splitCsv(payload.interests),
      portfolioLinks: [] as string[],
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), profileDoc);
    // Best-effort; emulator just logs this, real Firebase sends a real email.
    sendEmailVerification(cred.user).catch(() => {});
    setUser(docToProfile(cred.user.uid, profileDoc));
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updateLocalUser = useCallback((patch: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, register, logout, updateLocalUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

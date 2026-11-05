import { FirebaseError } from "firebase/app";

const AUTH_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/user-not-found": "Invalid email address.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/requires-recent-login": "Please log out and back in, then try again.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return AUTH_MESSAGES[err.code] || err.message || "Something went wrong. Please try again.";
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message) || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

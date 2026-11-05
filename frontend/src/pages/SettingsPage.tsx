import { useState } from "react";
import { KeyRound } from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useAuth } from "../lib/AuthContext";
import { errorMessage } from "../lib/errors";

export default function SettingsPage() {
  const { firebaseUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!firebaseUser || !firebaseUser.email) return;
    if (newPassword !== confirm) {
      setNotice({ type: "error", text: "Passwords do not match. Please re-enter both passwords." });
      return;
    }
    setLoading(true);
    try {
      // Firebase requires a recent sign-in before a sensitive change like a
      // password update, so we re-authenticate with the current password
      // first -- this also doubles as verifying it's actually correct.
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email, currentPassword));
      await updatePassword(firebaseUser, newPassword);
      setNotice({ type: "success", text: "Password updated successfully." });
      setCurrentPassword(""); setNewPassword(""); setConfirm("");
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h1>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
          <KeyRound size={18} className="text-brand-500" /> Change Password
        </h2>
        {notice && (
          <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{notice.text}</div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

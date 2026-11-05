import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../lib/firebase";
import { errorMessage } from "../lib/errors";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  // Firebase's password-reset emails link back with ?oobCode=... (and often
  // mode=resetPassword); we also accept ?token= for anyone who bookmarked
  // the old URL shape.
  const [code, setCode] = useState(params.get("oobCode") || params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Passwords do not match. Please re-enter both passwords.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, code, newPassword);
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Heart className="fill-brand-500 text-brand-500" size={26} />
          <span className="text-xl font-bold text-gray-900">CollabCupid</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 text-center mb-4">Set a new password</h1>

        {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        {done ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            Password reset. Redirecting you to login...
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
              <p className="text-xs text-gray-400 mt-1">From the link in your reset email (the oobCode parameter).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
        <p className="text-center text-sm text-gray-600 mt-4">
          <Link to="/login" className="text-brand-600 hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import { errorMessage } from "../lib/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      // Don't reveal whether an account exists for this email.
      if (err?.code === "auth/user-not-found") {
        setSent(true);
      } else {
        setError(errorMessage(err));
      }
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
        <h1 className="text-lg font-semibold text-gray-900 text-center mb-1">Reset your password</h1>
        <p className="text-sm text-gray-500 text-center mb-6">We'll email you a reset link.</p>

        {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {sent ? (
          <div className="text-sm text-gray-700 bg-emerald-50 rounded-lg px-3 py-3 space-y-2">
            <p>If that email is registered, a reset link has been sent.</p>
            <p className="text-xs text-gray-500">
              Running against the Firebase emulator? Open the Auth tab of the Emulator UI
              (http://localhost:4000/auth) to see the reset link it logged instead of sending a real email.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registered Email Address</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send Reset Link"}
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

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { errorMessage } from "../lib/errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] -m-4 sm:-m-7 flex flex-col md:flex-row">
      {/* Hero panel */}
      <div className="md:flex-[1.1] cc-gradient-bg-diag text-white flex flex-col justify-center px-8 sm:px-16 py-16">
        <div className="text-3xl font-extrabold mb-4">💜 CollabCupid</div>
        <h1 className="text-3xl font-bold leading-snug mb-4 max-w-md">
          Find your perfect<br />project match.
        </h1>
        <p className="text-white/90 text-[15px] leading-relaxed max-w-md">
          Post an idea, discover collaborators with the skills you need, and build
          something real with your classmates — one sprint at a time.
        </p>
        <div className="flex gap-10 mt-11">
          <Stat value="120+" label="Active Projects" />
          <Stat value="340+" label="Student Profiles" />
          <Stat value="6" label="Core Modules" />
        </div>
      </div>

      {/* Form panel */}
      <div className="md:flex-1 flex items-center justify-center bg-white px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="flex bg-brand-50 rounded-xl p-1 mb-7">
            <span className="flex-1 text-center py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-brand-700">Log In</span>
            <Link to="/register" className="flex-1 text-center py-2 text-sm font-semibold rounded-lg text-brand-700">Create Account</Link>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Log in with your institutional email to continue.</p>

          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <form onSubmit={submit} className="space-y-0">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mt-0">Institutional Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E0F0] bg-[#FAFAFC] text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="you@institution.edu"
            />
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mt-4">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E0F0] bg-[#FAFAFC] text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="••••••••"
            />

            <button
              type="submit" disabled={loading}
              className="w-full cc-gradient-btn text-white font-semibold py-3 rounded-lg disabled:opacity-60 mt-6"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div className="flex items-center justify-between mt-4 text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot Password?</Link>
          </div>
          <p className="text-center text-xs text-gray-500 mt-5">
            Don't have an account? <Link to="/register" className="text-accent-600 font-semibold hover:underline">Create one</Link>
          </p>
          <div className="mt-6 text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
            Demo accounts: see README-FIREBASE.md for emulator seed logins.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b className="block text-2xl font-bold">{value}</b>
      <span className="text-xs text-white/75">{label}</span>
    </div>
  );
}

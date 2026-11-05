import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { errorMessage } from "../lib/errors";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm_password: "",
    institution: "", skills: "", interests: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match. Please re-enter both passwords.");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] -m-4 sm:-m-7 flex flex-col md:flex-row">
      {/* Hero panel — same gradient hero as LoginPage, for a consistent split-screen auth flow */}
      <div className="md:flex-[1.1] cc-gradient-bg-diag text-white flex flex-col justify-center px-8 sm:px-16 py-16">
        <div className="text-3xl font-extrabold mb-4">💜 CollabCupid</div>
        <h1 className="text-3xl font-bold leading-snug mb-4 max-w-md">
          Post ideas. Find partners.<br />Build for fun.
        </h1>
        <p className="text-white/90 text-[15px] leading-relaxed max-w-md">
          Create a profile, list the skills you bring, and start matching with
          classmates who are building something you'd want to join.
        </p>
        <div className="flex gap-10 mt-11">
          <Stat value="120+" label="Active Projects" />
          <Stat value="340+" label="Student Profiles" />
          <Stat value="6" label="Core Modules" />
        </div>
      </div>

      {/* Form panel */}
      <div className="md:flex-1 flex items-center justify-center bg-white px-6 py-14">
        <div className="w-full max-w-md">
          <div className="flex bg-brand-50 rounded-xl p-1 mb-7">
            <Link to="/login" className="flex-1 text-center py-2 text-sm font-semibold rounded-lg text-brand-700">Log In</Link>
            <span className="flex-1 text-center py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-brand-700">Create Account</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">Create your account</h2>
          <p className="text-sm text-gray-500 mb-6">Post ideas. Find partners. Build for fun.</p>

          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Full Name" value={form.name} onChange={set("name")} required />
            <Field label="Institutional Email" type="email" value={form.email} onChange={set("email")} required />
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Password" type="password" value={form.password} onChange={set("password")} required />
              <Field label="Confirm Password" type="password" value={form.confirm_password} onChange={set("confirm_password")} required />
            </div>
            <Field label="Educational Institution" value={form.institution} onChange={set("institution")} />
            <Field label="Skills (comma-separated)" value={form.skills} onChange={set("skills")} placeholder="React, Python, Figma" />
            <Field label="Areas of Interest (comma-separated)" value={form.interests} onChange={set("interests")} placeholder="AI, Hackathons, Design" />

            <button
              type="submit" disabled={loading}
              className="w-full cc-gradient-btn text-white font-semibold py-3 rounded-lg disabled:opacity-60 mt-2"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account? <Link to="/login" className="text-accent-600 font-semibold hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E0F0] bg-[#FAFAFC] text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
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

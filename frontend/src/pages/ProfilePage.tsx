import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { editProfile } from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import Avatar from "../components/Avatar";

function splitCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function ProfilePage() {
  const { user, updateLocalUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    institution: user?.institution || "",
    skills: user?.skills.join(", ") || "",
    interests: user?.interests.join(", ") || "",
    portfolio_links: user?.portfolioLinks.join(", ") || "",
    profile_picture_url: user?.profilePictureUrl || "",
  });

  if (!user) return null;

  const startEdit = () => {
    setForm({
      name: user.name, bio: user.bio || "", institution: user.institution || "",
      skills: user.skills.join(", "), interests: user.interests.join(", "),
      portfolio_links: user.portfolioLinks.join(", "), profile_picture_url: user.profilePictureUrl || "",
    });
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await editProfile(user.id, {
        name: form.name,
        bio: form.bio,
        institution: form.institution,
        profilePictureUrl: form.profile_picture_url,
        skills: form.skills,
        interests: form.interests,
        portfolioLinks: form.portfolio_links,
      });
      updateLocalUser({
        name: form.name.trim(),
        bio: form.bio,
        institution: form.institution,
        profilePictureUrl: form.profile_picture_url || null,
        skills: splitCsv(form.skills),
        interests: splitCsv(form.interests),
        portfolioLinks: splitCsv(form.portfolio_links),
      });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={user.name} src={user.profilePictureUrl} size={72} />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                  <p className="text-sm text-gray-500">{user.institution}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </div>
              <button onClick={startEdit} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50">
                <Pencil size={14} /> Edit Profile
              </button>
            </div>

            {user.bio && <p className="text-gray-700 mt-4">{user.bio}</p>}

            <ProfileSection title="Skills" items={user.skills} />
            <ProfileSection title="Areas of Interest" items={user.interests} />
            {user.portfolioLinks.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-1.5">Portfolio Links</p>
                <div className="space-y-1">
                  {user.portfolioLinks.map((l) => (
                    <a key={l} href={l} target="_blank" rel="noreferrer" className="block text-sm text-brand-600 hover:underline truncate">{l}</a>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Edit Profile</h2>
              <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <Field label="Profile Picture URL" value={form.profile_picture_url} onChange={(v) => setForm((f) => ({ ...f, profile_picture_url: v }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About</label>
              <textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <Field label="Educational Institution" value={form.institution} onChange={(v) => setForm((f) => ({ ...f, institution: v }))} />
            <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} />
            <Field label="Areas of Interest (comma-separated)" value={form.interests} onChange={(v) => setForm((f) => ({ ...f, interests: v }))} />
            <Field label="Portfolio Links (comma-separated)" value={form.portfolio_links} onChange={(v) => setForm((f) => ({ ...f, portfolio_links: v }))} />
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
              <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ProfileSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s}</span>)}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
    </div>
  );
}

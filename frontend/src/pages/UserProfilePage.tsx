import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, UserPlus } from "lucide-react";
import { getUserProfile, getUserOwnedProjects, getProject, openOrCreateDirectConversation, inviteCollaborator } from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../lib/AuthContext";
import Avatar from "../components/Avatar";
import ProjectCard from "../components/ProjectCard";
import type { UserProfile, ProjectSummary } from "../types";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [myProjects, setMyProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      // Fetch the profile and that user's owned-projects list independently.
      // These used to be fetched with Promise.all, which rejects as a whole
      // the moment either call fails -- so a transient/slow error from the
      // projects query alone was enough to mark a perfectly real profile as
      // "unavailable or deleted". The profile is the only thing that should
      // ever trigger that message; a failed projects fetch should just leave
      // that section empty.
      try {
        const p = await getUserProfile(id);
        if (!p) {
          setNotFound(true);
          return;
        }
        setProfile(p);
      } catch {
        setNotFound(true);
        return;
      }
      try {
        setProjects(await getUserOwnedProjects(id));
      } catch {
        setProjects([]);
      }
    })();
  }, [id]);

  const openChat = async () => {
    if (!profile || !me) return;
    const convoId = await openOrCreateDirectConversation(me, profile);
    navigate(`/chats/${convoId}`);
  };

  const openInvite = async () => {
    if (!me) return;
    setMyProjects(await getUserOwnedProjects(me.id));
    setInviteOpen(true);
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !profile) return;
    try {
      const detail = await getProject(selectedProject);
      if (!detail) throw new Error("That project could not be found.");
      await inviteCollaborator(detail, me, profile, null, inviteMessage);
      setNotice({ type: "success", text: "Invitation sent." });
      setInviteOpen(false);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    }
  };

  if (notFound) return <p className="text-sm text-gray-600">This profile is unavailable or has been deleted.</p>;
  if (!profile) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {notice && (
        <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{notice.text}</div>
      )}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} src={profile.profilePictureUrl} size={72} online={profile.isOnline} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-sm text-gray-500">{profile.institution}</p>
              <p className="text-xs text-gray-400">{profile.isOnline ? "Online now" : "Offline"}</p>
            </div>
          </div>
          {me && me.id !== profile.id && (
            <div className="flex gap-2">
              <button onClick={openChat} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50">
                <MessageSquare size={14} /> Contact
              </button>
              <button onClick={openInvite} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-brand-500 text-white hover:bg-brand-600">
                <UserPlus size={14} /> Invite to Project
              </button>
            </div>
          )}
        </div>

        {profile.bio && <p className="text-gray-700 mt-4">{profile.bio}</p>}
        <ProfileSection title="Skills" items={profile.skills} />
        <ProfileSection title="Areas of Interest" items={profile.interests} />
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">Projects by {profile.name}</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">No projects yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">{projects.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
        )}
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setInviteOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Invite {profile.name} to a Project</h3>
            {myProjects.length === 0 ? (
              <p className="text-sm text-gray-500">You don't have any projects to invite this user to.</p>
            ) : (
              <form onSubmit={sendInvite} className="space-y-3">
                <select required value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                  <option value="">Select a project</option>
                  {myProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={3} placeholder="Optional message..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setInviteOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium">Cancel</button>
                  <button type="submit" className="flex-1 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium">Send Invitation</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">{items.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s}</span>)}</div>
    </div>
  );
}

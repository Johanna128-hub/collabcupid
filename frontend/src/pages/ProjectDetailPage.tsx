import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { GitBranch, MessageSquare, UserPlus, UserMinus, Pencil } from "lucide-react";
import { getProject, requestToJoin, removeCollaborator as fsRemoveCollaborator, getUserProfile, openOrCreateDirectConversation } from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../lib/AuthContext";
import Avatar from "../components/Avatar";
import type { ProjectDetail } from "../types";

function timeAgo(ms: number) {
  const days = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getProject(id);
      if (!p) setNotFound(true);
      else setProject(p);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const isOwner = user && project && project.ownerId === user.id;
  const isMember = user && project && project.teamMembers.some((m) => m.id === user.id);

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !user) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await requestToJoin(project, user, selectedPosition || null, message);
      setNotice({ type: "success", text: "Your request has been sent and is pending review." });
      setJoinOpen(false);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const removeCollaborator = async (positionId: string) => {
    if (!id) return;
    if (!confirm("Remove this collaborator from the project?")) return;
    try {
      await fsRemoveCollaborator(id, positionId);
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    }
  };

  const openChatWithOwner = async () => {
    if (!project || !user) return;
    const owner = await getUserProfile(project.ownerId);
    if (!owner) return;
    const convoId = await openOrCreateDirectConversation(user, owner);
    navigate(`/chats/${convoId}`);
  };

  if (loading) return <p className="text-sm text-gray-400">Loading project...</p>;
  if (notFound || !project) return <p className="text-sm text-gray-600">This project is no longer available.</p>;

  const openPositions = project.positions.filter((p) => !p.isFilled);
  const filledCount = project.positions.length - openPositions.length;
  const selectedPositionLabel = openPositions.find((p) => p.id === selectedPosition)?.roleName;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3.5">
        Discover <span className="mx-1.5">›</span> Projects <span className="mx-1.5">›</span> {project.title}
      </p>

      {notice && (
        <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {notice.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-[#ECE8F5] rounded-2xl p-6 mb-5">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              {project.category && (
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{project.category}</span>
              )}
              <span className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${project.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {project.status === "open" ? `Open · ${filledCount} of ${project.positions.length} filled` : "Team Full"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-extrabold text-gray-900">{project.title}</h1>
              {isOwner && (
                <Link to={`/projects/${project.id}/edit`} className="shrink-0 flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-50">
                  <Pencil size={14} /> Edit
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <Avatar name={project.ownerName} src={project.ownerProfilePictureUrl} size={22} />
              <Link to={`/users/${project.ownerId}`} className="text-sm text-gray-500 hover:underline">{project.ownerName}</Link>
            </div>

            <p className="text-[13.5px] text-gray-600 leading-relaxed mt-4 whitespace-pre-line">{project.description}</p>

            {project.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5">
                {project.technologies.map((t, i) => (
                  <span key={t} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${i % 3 === 1 ? "bg-accent-100 text-accent-700" : "bg-brand-50 text-brand-700"}`}>{t}</span>
                ))}
              </div>
            )}
            {project.requiredSkills.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">Required Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.requiredSkills.map((t) => <span key={t} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-accent-100 text-accent-700">{t}</span>)}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-6">
              {!isOwner && !isMember && user && project.status === "open" && (
                <button onClick={() => setJoinOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg cc-gradient-btn text-white text-sm font-semibold">
                  <UserPlus size={16} /> Request to Join
                </button>
              )}
              {!isOwner && user && (
                <button onClick={openChatWithOwner} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E4DEF2] text-brand-700 bg-white text-sm font-semibold hover:bg-brand-50">
                  <MessageSquare size={16} /> Contact Project Owner
                </button>
              )}
              {(isOwner || isMember) && (
                <>
                  <Link to={`/projects/${project.id}/repository`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E4DEF2] text-brand-700 bg-white text-sm font-semibold hover:bg-brand-50">
                    <GitBranch size={16} /> Repository
                  </Link>
                  <Link to={`/chats?project=${project.id}`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E4DEF2] text-brand-700 bg-white text-sm font-semibold hover:bg-brand-50">
                    <MessageSquare size={16} /> Group Chat
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#ECE8F5] rounded-2xl p-6">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-gray-500 mb-3.5">Open Positions</h2>
            <div>
              {project.positions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between gap-3 py-3.5 border-b border-[#F1EEF8] last:border-b-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {pos.filledByUserId ? (
                      <Avatar name={pos.filledByName || ""} src={pos.filledByProfilePictureUrl} size={32} />
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-gray-800 truncate">{pos.roleName}</p>
                      <p className="text-xs text-gray-500">
                        {pos.filledByUserId ? <Link to={`/users/${pos.filledByUserId}`} className="hover:underline">{pos.filledByName}</Link> : "Open position"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pos.isFilled ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                      {pos.isFilled ? "Filled" : "Open"}
                    </span>
                    {isOwner && pos.filledByUserId && (
                      <button onClick={() => removeCollaborator(pos.id)} className="text-red-500 hover:text-red-700 p-1" title="Remove collaborator">
                        <UserMinus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {project.positions.length === 0 && <p className="text-sm text-gray-400 py-2">No specific roles were defined for this project.</p>}
            </div>
          </div>
        </div>

        <div className="md:w-[290px] shrink-0">
          <div className="bg-white border border-[#ECE8F5] rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Avatar name={project.ownerName} src={project.ownerProfilePictureUrl} size={36} />
              <div className="min-w-0">
                <Link to={`/users/${project.ownerId}`} className="text-[13.5px] font-bold text-gray-900 hover:underline block truncate">{project.ownerName}</Link>
                <p className="text-[11.5px] text-gray-500">Project Owner</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-gray-500 py-1.5 border-t border-[#F1EEF8]">
              <span>Posted</span><b className="text-gray-900">{timeAgo(project.createdAtMs)}</b>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-gray-500 py-1.5 border-t border-[#F1EEF8]">
              <span>Team size</span><b className="text-gray-900">{project.teamMembers.length}</b>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-gray-500 py-1.5 border-t border-[#F1EEF8]">
              <span>Open positions</span><b className="text-gray-900">{openPositions.length}</b>
            </div>
            {!isOwner && !isMember && user && project.status === "open" && (
              <button onClick={() => setJoinOpen(true)} className="w-full mt-3.5 py-2.5 rounded-lg cc-gradient-btn text-white text-sm font-semibold">
                Request to Join
              </button>
            )}
          </div>
        </div>
      </div>

      {joinOpen && (
        <div className="fixed inset-0 bg-[rgba(28,14,48,0.45)] flex items-center justify-center z-50 px-4" onClick={() => setJoinOpen(false)}>
          <div className="bg-white rounded-2xl p-7 w-full max-w-[480px] shadow-[0_20px_50px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1.5">Request to Join</h3>
            <p className="text-[13px] text-gray-500 mb-5">
              Sending a request {selectedPositionLabel ? <>for <b className="text-gray-700">{selectedPositionLabel}</b> </> : ""}on {project.title}
            </p>
            <form onSubmit={submitJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Position</label>
                <select value={selectedPosition} onChange={(e) => setSelectedPosition(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E0F0] bg-[#FAFAFC] text-sm">
                  <option value="">Any open position</option>
                  {openPositions.map((p) => <option key={p.id} value={p.id}>{p.roleName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Note to the project owner (optional)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E0F0] bg-[#FAFAFC] text-sm"
                  placeholder="Tell them why you'd be a great fit..." />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={() => setJoinOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#E4DEF2] text-brand-700 bg-white text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg cc-gradient-btn text-white text-sm font-semibold disabled:opacity-60">
                  {submitting ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

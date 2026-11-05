import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  getUserOwnedProjects, getUserCollaborations, getIncomingRequests, getMyInvitations,
  acceptRequest, rejectRequest,
} from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../lib/AuthContext";
import ProjectCard from "../components/ProjectCard";
import Avatar from "../components/Avatar";
import type { ProjectSummary, CollaborationRequestOut } from "../types";

export default function MyProjectsPage() {
  const { user } = useAuth();
  const [owned, setOwned] = useState<ProjectSummary[]>([]);
  const [collaborations, setCollaborations] = useState<ProjectSummary[]>([]);
  const [incoming, setIncoming] = useState<CollaborationRequestOut[]>([]);
  const [invitations, setInvitations] = useState<CollaborationRequestOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setNotice(null);
    // Each section is fetched independently (Promise.allSettled, not
    // Promise.all) so that one query failing -- e.g. a transient Firestore
    // error on the incoming-requests query -- doesn't blank out every other
    // section of this page. Promise.all would reject as a whole the moment
    // any single promise rejected, silently leaving owned/collaborations/
    // incoming/invitations all at their initial empty-array state with no
    // visible error.
    const [oRes, cRes, incRes, invRes] = await Promise.allSettled([
      getUserOwnedProjects(user.id),
      getUserCollaborations(user.id),
      getIncomingRequests(user.id),
      getMyInvitations(user.id),
    ]);
    const failures: string[] = [];
    if (oRes.status === "fulfilled") setOwned(oRes.value); else failures.push(errorMessage(oRes.reason));
    if (cRes.status === "fulfilled") setCollaborations(cRes.value); else failures.push(errorMessage(cRes.reason));
    if (incRes.status === "fulfilled") setIncoming(incRes.value); else failures.push(errorMessage(incRes.reason));
    if (invRes.status === "fulfilled") setInvitations(invRes.value); else failures.push(errorMessage(invRes.reason));
    if (failures.length > 0) setNotice(`Some sections of this page couldn't load: ${failures.join(" ")}`);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const respond = async (requestId: string, action: "accept" | "reject") => {
    setNotice(null);
    try {
      if (action === "accept") await acceptRequest(requestId);
      else await rejectRequest(requestId);
      load();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="space-y-8">
      {notice && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{notice}</div>}

      {incoming.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Join Requests Awaiting Your Review</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={r.requesterName} src={r.requesterProfilePictureUrl} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      <Link to={`/users/${r.requesterId}`} className="font-medium hover:underline">{r.requesterName}</Link> wants to join <span className="font-medium">{r.projectTitle}</span>
                      {r.positionRole && <span className="text-gray-500"> as {r.positionRole}</span>}
                    </p>
                    {r.message && <p className="text-xs text-gray-500 truncate">"{r.message}"</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => respond(r.id, "accept")} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={16} /></button>
                  <button onClick={() => respond(r.id, "reject")} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {invitations.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Invitations Sent to You</h2>
          <div className="space-y-2">
            {invitations.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-sm text-gray-800">
                  You've been invited to join <Link to={`/projects/${r.projectId}`} className="font-medium hover:underline">{r.projectTitle}</Link>
                  {r.positionRole && <span className="text-gray-500"> as {r.positionRole}</span>}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => respond(r.id, "accept")} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={16} /></button>
                  <button onClick={() => respond(r.id, "reject")} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Projects You Own</h2>
        {owned.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
            You haven't created any projects yet. <Link to="/create-project" className="text-brand-600 font-medium hover:underline">Create one</Link>.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{owned.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Projects You Collaborate On</h2>
        {collaborations.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">You aren't collaborating on any projects yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{collaborations.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
        )}
      </section>
    </div>
  );
}

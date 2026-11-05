import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { getProject, createProject, updateProject } from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../lib/AuthContext";

export default function CreateProjectPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [allowRequests, setAllowRequests] = useState(true);
  const [positions, setPositions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editing || !id) return;
    (async () => {
      const p = await getProject(id);
      if (!p) return;
      setTitle(p.title);
      setDescription(p.description);
      setCategory(p.category || "");
      setTechnologies(p.technologies.join(", "));
      setRequiredSkills(p.requiredSkills.join(", "));
      setAllowRequests(p.allowRequests);
    })();
  }, [id, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;
    setLoading(true);
    try {
      if (editing && id) {
        await updateProject(id, {
          title, description, category, technologies, requiredSkills, allowRequests,
        });
        navigate(`/projects/${id}`);
      } else {
        const newId = await createProject(user, {
          title, description, category, technologies, requiredSkills, allowRequests,
          positions: positions.filter((p) => p.trim()),
        });
        navigate(`/projects/${newId}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">{editing ? "Edit Project" : "Post a New Project"}</h1>
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category / Domain</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technologies (comma-separated)</label>
            <input value={technologies} onChange={(e) => setTechnologies(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills (comma-separated)</label>
          <input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>

        {!editing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Open Positions</label>
            {positions.map((pos, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={pos}
                  onChange={(e) => setPositions((arr) => arr.map((p, idx) => (idx === i ? e.target.value : p)))}
                  placeholder="e.g. Frontend Developer"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                {positions.length > 1 && (
                  <button type="button" onClick={() => setPositions((arr) => arr.filter((_, idx) => idx !== i))} className="px-2 text-gray-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setPositions((arr) => [...arr, ""])} className="flex items-center gap-1 text-sm text-brand-600 font-medium hover:underline">
              <Plus size={14} /> Add another role
            </button>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={allowRequests} onChange={(e) => setAllowRequests(e.target.checked)} />
          Allow collaborators to send join requests
        </label>

        <button type="submit" disabled={loading} className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
          {loading ? "Saving..." : editing ? "Save Changes" : "Create Project"}
        </button>
      </form>
    </div>
  );
}

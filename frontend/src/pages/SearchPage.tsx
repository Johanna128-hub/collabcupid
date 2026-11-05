import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { searchProjects, searchCollaborators } from "../lib/firestoreApi";
import { useAuth } from "../lib/AuthContext";
import ProjectCard from "../components/ProjectCard";
import CollaboratorCard from "../components/CollaboratorCard";
import type { ProjectSummary, UserProfile } from "../types";

type Tab = "projects" | "collaborators";

export default function SearchPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("projects");
  const [q, setQ] = useState(params.get("q") || "");
  const [technology, setTechnology] = useState("");
  const [skill, setSkill] = useState("");
  const [institution, setInstitution] = useState("");
  const [category, setCategory] = useState("");
  const [interest, setInterest] = useState("");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      if (tab === "projects") {
        setProjects(await searchProjects({
          q: q || undefined,
          technology: technology || undefined,
          skill: skill || undefined,
          category: category || undefined,
          institution: institution || undefined,
          openPositionsOnly: false,
        }));
      } else {
        setCollaborators(await searchCollaborators(user?.id || "", {
          q: q || undefined,
          skill: skill || undefined,
          institution: institution || undefined,
          interest: interest || undefined,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setParams(q ? { q } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <div className="flex gap-6">
      {/* Filter sidebar, always visible like the Discovery mockup */}
      <div className="w-60 shrink-0 hidden md:block">
        <form onSubmit={submit}>
          <div className="bg-white border border-[#ECE8F5] rounded-2xl p-4 mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Skill</h4>
            <FilterInput value={skill} onChange={setSkill} placeholder="e.g. React" />
          </div>
          {tab === "projects" ? (
            <>
              <div className="bg-white border border-[#ECE8F5] rounded-2xl p-4 mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Technology</h4>
                <FilterInput value={technology} onChange={setTechnology} placeholder="e.g. Firebase" />
              </div>
              <div className="bg-white border border-[#ECE8F5] rounded-2xl p-4 mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Category</h4>
                <FilterInput value={category} onChange={setCategory} placeholder="e.g. Web Platform" />
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#ECE8F5] rounded-2xl p-4 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Interest</h4>
              <FilterInput value={interest} onChange={setInterest} placeholder="e.g. Hackathons" />
            </div>
          )}
          <div className="bg-white border border-[#ECE8F5] rounded-2xl p-4 mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Institution</h4>
            <FilterInput value={institution} onChange={setInstitution} placeholder="e.g. Mepco Schlenk" />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg cc-gradient-btn text-white text-sm font-semibold">Apply Filters</button>
        </form>
      </div>

      <div className="flex-1 min-w-0">
        <form onSubmit={submit} className="flex items-center gap-3 bg-white border border-[#ECE8F5] rounded-xl px-4 py-3 mb-4">
          <SearchIcon size={16} className="text-gray-400 shrink-0" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "projects" ? 'Search by project name or keyword — e.g. "React"' : 'Search by skill, name, or keyword — e.g. "React"'}
            className="flex-1 text-sm focus:outline-none"
          />
          <button type="submit" className="text-sm font-semibold text-brand-600 shrink-0">Search</button>
        </form>

        <div className="flex gap-6 border-b border-[#ECE8F5] mb-5">
          {(["projects", "collaborators"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm font-semibold capitalize pb-3 -mb-px border-b-2 transition-colors ${
                tab === t ? "text-brand-700 border-brand-700" : "text-gray-400 border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Searching...</p>
        ) : tab === "projects" ? (
          projects.length === 0 ? (
            <EmptyState searched={searched} kind="projects" />
          ) : (
            <>
              <p className="text-[12.5px] text-gray-500 mb-3.5">{projects.length} project{projects.length === 1 ? "" : "s"} match your filters</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </>
          )
        ) : collaborators.length === 0 ? (
          <EmptyState searched={searched} kind="collaborators" />
        ) : (
          <>
            <p className="text-[12.5px] text-gray-500 mb-3.5">{collaborators.length} collaborator{collaborators.length === 1 ? "" : "s"} match your filters</p>
            <div className="space-y-3">
              {collaborators.map((u) => <CollaboratorCard key={u.id} user={u} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
    />
  );
}

function EmptyState({ searched, kind }: { searched: boolean; kind: string }) {
  return (
    <div className="text-center bg-white border border-dashed border-gray-200 rounded-xl p-10">
      <p className="text-gray-600 font-medium">No {kind} found.</p>
      {searched && <p className="text-sm text-gray-400 mt-1">Try modifying your search criteria.</p>}
    </div>
  );
}

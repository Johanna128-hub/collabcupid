import { useEffect, useState } from "react";
import { Sparkles, Clock, DoorOpen, Users2, LayoutGrid, FolderKanban, UserRound } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { getRecentProjects, searchProjects, recommendProjectsForUser, searchCollaborators } from "../lib/firestoreApi";
import ProjectCard from "../components/ProjectCard";
import CollaboratorCard from "../components/CollaboratorCard";
import type { ProjectSummary, UserProfile } from "../types";

type HomeFilter = "all" | "projects" | "profiles";

function ProjectSection({ title, icon: Icon, projects, empty }: { title: string; icon: any; projects: ProjectSummary[]; empty: string }) {
  return (
    <section className="mb-9">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-3.5">
        <Icon size={18} className="text-brand-500" /> {title}
      </h2>
      {projects.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">{empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </section>
  );
}

function CollaboratorSection({ collaborators }: { collaborators: UserProfile[] }) {
  return (
    <section className="mb-9">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-3.5">
        <Users2 size={18} className="text-brand-500" /> Collaborators to Meet
      </h2>
      {collaborators.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
          No other collaborator profiles yet — check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {collaborators.map((c) => <CollaboratorCard key={c.id} user={c} />)}
        </div>
      )}
    </section>
  );
}

const FILTER_OPTIONS: { key: HomeFilter; label: string; icon: any }[] = [
  { key: "all", label: "All Projects", icon: LayoutGrid },
  { key: "projects", label: "Open Positions", icon: FolderKanban },
  { key: "profiles", label: "Profiles", icon: UserRound },
];

export default function HomePage() {
  const { user } = useAuth();
  const [recommended, setRecommended] = useState<ProjectSummary[]>([]);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [openPositions, setOpenPositions] = useState<ProjectSummary[]>([]);
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HomeFilter>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const requests: Promise<unknown>[] = [
          getRecentProjects(6),
          searchProjects({}),
          searchCollaborators(user?.id || "", {}),
        ];
        if (user) requests.push(recommendProjectsForUser(user, 6));
        const results = await Promise.all(requests);
        setRecent(results[0] as ProjectSummary[]);
        setOpenPositions((results[1] as ProjectSummary[]).filter((p) => p.openPositionsCount > 0));
        setCollaborators((results[2] as UserProfile[]).slice(0, 6));
        if (user) setRecommended(results[3] as ProjectSummary[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const showProjects = filter === "all" || filter === "projects";
  const showProfiles = filter === "all" || filter === "profiles";
  const firstName = user?.name.split(" ")[0];

  return (
    <div>
      {/* No page-local "New Project" button here -- the persistent top nav
          (Layout.tsx) already has one on every page, including this one.
          This page used to have its own copy too, so a signed-in user
          landing on the dashboard saw two "create a project" buttons at
          once: this one and the header's. */}
      <div className="flex items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user ? `Welcome back, ${firstName} 👋` : "Post Ideas. Find Partners. Build for Fun."}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user
              ? `${openPositions.length} open project${openPositions.length === 1 ? "" : "s"} match your skills right now`
              : "Discover student-led projects and teammates across every campus."}
          </p>
        </div>
      </div>

      <div className="mb-7 flex items-center gap-2.5">
        {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border transition-colors ${
              filter === key ? "bg-brand-700 text-white border-brand-700" : "bg-white text-gray-500 border-[#ECE8F5] hover:bg-gray-50"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading recommendations...</p>
      ) : (
        <>
          {showProjects && (
            <>
              {user && (
                <ProjectSection title="Recommended for You" icon={Sparkles} projects={recommended} empty="Add skills to your profile to get personalized recommendations." />
              )}
              <ProjectSection title="Recently Created Projects" icon={Clock} projects={recent} empty="No projects yet — be the first to post one!" />
              <ProjectSection title="Open Collaboration Positions" icon={DoorOpen} projects={openPositions} empty="No open positions right now." />
            </>
          )}
          {showProfiles && <CollaboratorSection collaborators={collaborators} />}
        </>
      )}
    </div>
  );
}

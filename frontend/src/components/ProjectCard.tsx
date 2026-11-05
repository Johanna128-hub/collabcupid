import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import Avatar from "./Avatar";
import type { ProjectSummary } from "../types";

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const isOpen = project.status === "open";

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-white rounded-2xl border border-[#ECE8F5] p-5 shadow-[0_1px_3px_rgba(31,16,60,0.08),0_1px_2px_rgba(31,16,60,0.04)] hover:shadow-md hover:border-brand-200 transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        {project.category && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
            {project.category}
          </span>
        )}
        <span
          className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
            isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isOpen ? "Open" : "Full"}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 leading-snug mt-2">{project.title}</h3>
      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{project.description}</p>

      {project.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {project.technologies.slice(0, 4).map((t, i) => (
            <span
              key={t}
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                i % 3 === 1 ? "bg-accent-100 text-accent-700" : "bg-brand-50 text-brand-700"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1EEF8]">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={project.ownerName} src={project.ownerProfilePictureUrl} size={22} />
          <span className="text-xs text-gray-600 truncate">{project.ownerName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-brand-600 shrink-0">
          <Users size={13} />
          {project.openPositionsCount} open
        </div>
      </div>
    </Link>
  );
}

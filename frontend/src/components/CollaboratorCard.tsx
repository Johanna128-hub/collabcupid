import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import type { UserProfile } from "../types";

// Horizontal row layout, matching the Discovery screen mockup's collaborator
// list (avatar + name/institution + skill tags + a "View Profile" pill on
// the right), rather than the previous vertical tile.
export default function CollaboratorCard({ user }: { user: UserProfile }) {
  return (
    <Link
      to={`/users/${user.id}`}
      className="flex items-center gap-4 bg-white rounded-2xl border border-[#ECE8F5] p-4 shadow-[0_1px_3px_rgba(31,16,60,0.08),0_1px_2px_rgba(31,16,60,0.04)] hover:shadow-md hover:border-brand-200 transition-shadow"
    >
      <Avatar name={user.name} src={user.profilePictureUrl} size={44} online={user.isOnline} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900 truncate">{user.name}</p>
        {user.institution && <p className="text-xs text-gray-500 mt-0.5 truncate">{user.institution}</p>}
        {user.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{user.bio}</p>}
        {user.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {user.skills.slice(0, 4).map((s) => (
              <span key={s} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700">{s}</span>
            ))}
          </div>
        )}
      </div>
      <span className="shrink-0 hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-lg bg-white text-brand-700 border border-[#E4DEF2]">
        View Profile
      </span>
    </Link>
  );
}

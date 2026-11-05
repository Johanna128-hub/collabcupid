import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu, X, Search, User, Folder, MessageSquare, Bell, Settings,
  LogOut, Heart, Plus, LayoutDashboard, Compass,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useNotifications } from "../lib/NotificationContext";
import Avatar from "./Avatar";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  // Always-visible top nav, matching the mockups' persistent gradient bar.
  //
  // "Repository" used to be its own entry here (and in drawerLinks below)
  // pointing at "/my-projects" -- the exact same destination as "My
  // Projects" -- which is why the two always opened together. There's no
  // single global repository to land on (a repository only makes sense in
  // the context of one project), so repository access lives on each
  // project's own page (the "Repository" button on ProjectDetailPage)
  // instead of duplicating "My Projects" here.
  const navLinks = [
    { label: "Dashboard", to: "/" },
    { label: "Discover", to: "/search" },
    { label: "My Projects", to: "/my-projects" },
    { label: "Messages", to: "/chats" },
  ];

  // Still used for the mobile drawer (small screens) and the account-settings
  // items that don't have a place in the horizontal bar.
  //
  // "Create Project" only appears here on small screens (see its sm:hidden
  // below) -- the header's own "+ New Project" button (also hidden on small
  // screens) already covers every wider viewport, so without that split
  // this and the header button would both be visible at once on desktop.
  const drawerLinks = [
    { label: "View Profile", icon: User, to: "/profile" },
    { label: "My Projects", icon: Folder, to: "/my-projects" },
    { label: "Create Project", icon: Plus, to: "/create-project" },
    { label: "Chats", icon: MessageSquare, to: "/chats" },
    { label: "Notifications", icon: Bell, to: "/notifications" },
    { label: "Settings", icon: Settings, to: "/settings" },
  ];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 cc-gradient-bg text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-7 h-16 flex items-center gap-3">
          {/* Mobile menu toggle (hidden on larger screens where the nav is inline) */}
          {user && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-white/15 text-white md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>
          )}

          <Link to="/" className="flex items-center gap-1.5 font-bold text-lg shrink-0">
            <Heart size={20} className="fill-accent-200 text-accent-200" />
            CollabCupid
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-6 ml-10 text-sm font-medium">
              {navLinks.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className={`pb-[18px] -mb-[1px] transition-colors ${
                    isActive(l.to)
                      ? "text-white border-b-2 border-white"
                      : "text-white/85 hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          {user && (
            <form onSubmit={submitSearch} className="flex-1 max-w-xs mx-auto relative hidden lg:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, skills..."
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-white/15 placeholder-white/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </form>
          )}

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/create-project"
                  className="hidden sm:flex items-center gap-1 text-sm font-semibold px-3.5 py-1.5 rounded-full bg-white text-brand-700 hover:bg-white/90"
                >
                  <Plus size={16} /> New Project
                </Link>
                <Link to="/notifications" className="relative p-2 rounded-full bg-white/15 hover:bg-white/25" aria-label="Notifications">
                  <Bell size={18} className="text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setAccountMenuOpen((o) => !o)}
                    className="ring-2 ring-white/40 rounded-full block"
                    aria-label="Account menu"
                    aria-expanded={accountMenuOpen}
                  >
                    <Avatar name={user.name} src={user.profilePictureUrl} size={34} />
                  </button>
                  {accountMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setAccountMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 text-gray-800">
                        <div className="px-3.5 py-2 border-b border-gray-100 mb-1">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.institution}</p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-gray-100"
                        >
                          <User size={16} /> View Profile
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-gray-100"
                        >
                          <Settings size={16} /> Settings
                        </Link>
                        <button
                          onClick={async () => {
                            setAccountMenuOpen(false);
                            await logout();
                            navigate("/login");
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 mt-1"
                        >
                          <LogOut size={16} /> Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium px-3 py-1.5 rounded-full hover:bg-white/15">Login</Link>
                <Link to="/register" className="text-sm font-semibold px-3.5 py-1.5 rounded-full bg-white text-brand-700 hover:bg-white/90">Register</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 bg-white h-full shadow-xl p-4 flex flex-col gap-1 animate-[slideIn_0.15s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-800">Menu</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            {user && (
              <div className="flex items-center gap-3 mb-4 p-2">
                <Avatar name={user.name} src={user.profilePictureUrl} size={44} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.institution}</p>
                </div>
              </div>
            )}
            <Link to="/" onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                location.pathname === "/" ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100"
              }`}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
            <Link to="/search" onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                location.pathname.startsWith("/search") ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100"
              }`}>
              <Compass size={18} /> Discover
            </Link>
            {drawerLinks.map(({ label, icon: Icon, to }) => (
              <Link key={label} to={to} onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  location.pathname === to ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100"
                } ${label === "Create Project" ? "sm:hidden" : ""}`}>
                <Icon size={18} /> {label}
              </Link>
            ))}
            {user && (
              <button onClick={async () => { setDrawerOpen(false); await logout(); navigate("/login"); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-2">
                <LogOut size={18} /> Logout
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-7 py-6">{children}</main>
    </div>
  );
}

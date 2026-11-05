import { CheckCheck, Trash2, Bell } from "lucide-react";
import { useNotifications } from "../lib/NotificationContext";

const LABELS: Record<string, string> = {
  collab_request_received: "New collaboration request",
  request_accepted: "Request accepted",
  request_rejected: "Request declined",
  added_to_project: "Added to project",
  removed_from_project: "Removed from project",
  repository_updated: "Repository updated",
  new_message: "New message",
  invitation_received: "Invitation received",
};

export default function NotificationsPage() {
  const { notifications, markRead, markAllRead, clear } = useNotifications();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
        {notifications.some((n) => !n.isRead) && (
          <button onClick={() => markAllRead()} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
            <CheckCheck size={15} /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-[#ECE8F5] rounded-2xl p-12">
          <Bell className="mx-auto text-brand-200 mb-2.5" size={32} />
          <p className="text-gray-500 text-sm">You're all caught up.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#ECE8F5] rounded-2xl overflow-hidden">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-[#F4F1FA] last:border-b-0 ${n.isRead ? "bg-white" : "bg-brand-50/50"}`}>
              <div className="flex gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-brand-200" : "bg-accent-600"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-brand-600 uppercase tracking-wide mb-0.5">{LABELS[n.type] || n.type}</p>
                  <p className="text-sm text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAtMs).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} title="Mark as read" className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50">
                    <CheckCheck size={15} />
                  </button>
                )}
                <button onClick={() => clear(n.id)} title="Clear" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

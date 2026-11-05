import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Send, Users, Search as SearchIcon } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useNotifications } from "../lib/NotificationContext";
import {
  subscribeToConversations,
  subscribeToMessages,
  subscribeToTyping,
  setTyping,
  sendMessage,
  markConversationRead,
  getProjectGroupConversationId,
} from "../lib/firestoreApi";
import Avatar from "../components/Avatar";
import type { ConversationOut, MessageOut } from "../types";

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

export default function ChatsPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications } = useNotifications();

  const [conversations, setConversations] = useState<ConversationOut[]>([]);
  const [convFilter, setConvFilter] = useState("");
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = conversations.find((c) => c.id === conversationId) || null;

  // Realtime conversation list -- replaces the old GET /api/conversations poll.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.id, setConversations);
    return () => unsub();
  }, [user]);

  // Resolve ?project=<id> into its group conversation and redirect.
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const convoId = await getProjectGroupConversationId(projectId);
      if (convoId) navigate(`/chats/${convoId}`, { replace: true });
    })();
  }, [projectId, navigate]);

  // Realtime message list for the active conversation.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToMessages(conversationId, setMessages);
    return () => unsub();
  }, [conversationId]);

  // Mark read whenever we open a conversation or a new message arrives in it.
  useEffect(() => {
    if (!conversationId || !user) return;
    markConversationRead(conversationId, user.id).catch(() => {});
  }, [conversationId, user, messages.length]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToTyping(conversationId, (ids) => setTypingUserIds(ids.filter((id) => id !== user?.id)));
    return () => unsub();
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear our own typing flag if we navigate away mid-type.
  useEffect(() => {
    return () => {
      if (conversationId && user) setTyping(conversationId, user.id, false).catch(() => {});
    };
  }, [conversationId, user]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !conversationId || !user) return;
    sendMessage(conversationId, user, draft.trim());
    setDraft("");
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    setTyping(conversationId, user.id, false).catch(() => {});
  };

  const onTypingChange = (val: string) => {
    setDraft(val);
    if (!conversationId || !user) return;
    setTyping(conversationId, user.id, true).catch(() => {});
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setTyping(conversationId, user.id, false).catch(() => {});
    }, 1500);
  };

  const otherMemberId = (c: ConversationOut) => c.memberIds.find((id) => id !== user?.id);
  const otherMemberName = (c: ConversationOut) => (otherMemberId(c) ? c.memberNames[otherMemberId(c)!] : "?");
  const otherMemberPic = (c: ConversationOut) => (otherMemberId(c) ? c.memberProfilePics?.[otherMemberId(c)!] : null);

  const filteredConversations = convFilter
    ? conversations.filter((c) => {
        const name = (c.isGroup ? c.projectTitle : otherMemberName(c)) || "";
        return name.toLowerCase().includes(convFilter.toLowerCase());
      })
    : conversations;

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div className="grid lg:grid-cols-[320px_1fr_300px] md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-140px)]">
      {/* Conversation list */}
      <div className="bg-white border border-[#ECE8F5] rounded-2xl overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-2 bg-[#F6F5FA] rounded-lg px-3.5 py-2.5">
            <SearchIcon size={14} className="text-gray-400 shrink-0" />
            <input
              value={convFilter} onChange={(e) => setConvFilter(e.target.value)}
              placeholder="Search conversations"
              className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
        {filteredConversations.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">No conversations yet. Contact a collaborator or project owner to start one.</p>
        ) : (
          filteredConversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chats/${c.id}`)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-[#F1EEF8] hover:bg-gray-50 ${
                conversationId === c.id ? "bg-brand-50 border-r-[3px] border-r-brand-600" : ""
              }`}
            >
              {c.isGroup ? (
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0"><Users size={17} className="text-brand-700" /></div>
              ) : (
                <Avatar name={otherMemberName(c) || "?"} src={otherMemberPic(c)} size={38} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-[13.5px] font-bold text-gray-900 truncate">{c.isGroup ? c.projectTitle : otherMemberName(c)}</p>
                  {c.unreadCount > 0 && <span className="shrink-0 text-[10px] font-bold bg-accent-600 text-white rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1">{c.unreadCount}</span>}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {c.lastMessageBody
                    ? `${c.lastMessageSenderId === user?.id ? "You" : (c.memberNames[c.lastMessageSenderId || ""] || "").split(" ")[0]}: ${c.lastMessageBody}`
                    : "No messages yet"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Chat pane */}
      <div className="bg-[#FBFAFD] border border-[#ECE8F5] rounded-2xl flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a conversation to start chatting.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 bg-white border-b border-[#ECE8F5]">
              {active.isGroup ? (
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center"><Users size={16} className="text-brand-700" /></div>
              ) : (
                <Avatar name={otherMemberName(active) || "?"} src={otherMemberPic(active)} size={36} />
              )}
              <div>
                <p className="text-[14.5px] font-bold text-gray-900">{active.isGroup ? active.projectTitle : otherMemberName(active)}</p>
                {active.isGroup && <p className="text-xs text-gray-400">{active.memberIds.length} members</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      mine
                        ? "cc-gradient-btn text-white rounded-br-[4px]"
                        : "bg-white border border-[#ECE8F5] text-gray-800 rounded-bl-[4px]"
                    }`}>
                      {active.isGroup && !mine && <p className="text-[11px] font-semibold mb-0.5 opacity-70">{m.senderName}</p>}
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className={`text-[10px] mt-1.5 ${mine ? "text-white/70" : "text-gray-400"}`}>{new Date(m.createdAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                );
              })}
              {typingUserIds.length > 0 && <p className="text-xs text-gray-400 italic">typing...</p>}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-center gap-2.5 p-4 bg-white border-t border-[#ECE8F5]">
              <input
                value={draft}
                onChange={(e) => onTypingChange(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E5E0F0] text-[13.5px] focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit" className="px-4 py-2.5 rounded-lg cc-gradient-btn text-white text-sm font-semibold flex items-center gap-1.5">
                Send <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Notifications side panel, matching the combined Messaging & Notifications mockup */}
      <div className="hidden lg:block bg-white border border-[#ECE8F5] rounded-2xl p-4 overflow-y-auto">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3.5">Notifications</h4>
        {recentNotifications.length === 0 ? (
          <p className="text-sm text-gray-400">You're all caught up.</p>
        ) : (
          <div>
            {recentNotifications.map((n) => (
              <div key={n.id} className="flex gap-2.5 py-2.5 border-b border-[#F4F1FA] last:border-b-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-brand-200" : "bg-accent-600"}`} />
                <div className="min-w-0">
                  <p className="text-[12.5px] text-gray-700 leading-snug">{n.message}</p>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">{new Date(n.createdAtMs).toLocaleDateString()} · {LABELS[n.type] || n.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeToNotifications,
  markNotificationRead as fsMarkNotificationRead,
  markAllNotificationsRead as fsMarkAllNotificationsRead,
  clearNotification as fsClearNotification,
} from "./firestoreApi";
import type { NotificationOut } from "../types";

interface Ctx {
  notifications: NotificationOut[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: (id: string) => Promise<void>;
}

const NotificationContext = createContext<Ctx | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    // Firestore's onSnapshot listener replaces the old socket.io "notification"
    // event entirely: it pushes every create/update on this user's
    // notifications in realtime, and re-fires with the full up-to-date list
    // whenever anything changes, so there's no separate initial-fetch step.
    const unsub = subscribeToNotifications(user.id, setNotifications);
    return () => unsub();
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fsMarkNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (ids.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fsMarkAllNotificationsRead(ids);
  }, [notifications]);

  const clear = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fsClearNotification(id);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, clear }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

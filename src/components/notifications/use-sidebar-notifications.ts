"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SidebarNotificationRow = {
  id: string;
  href: string;
  category: string;
  action_required: boolean;
  is_read: boolean;
  resolved_at: string | null;
};

export type SidebarNotificationCounts = Record<string, number>;

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function isActiveNotification(row: SidebarNotificationRow) {
  return row.action_required ? !row.resolved_at : !row.is_read;
}

/**
 * Reads the signed-in user's notification rows, subscribes to database changes,
 * and marks informational notifications as read when their destination page is opened.
 * Action-required notifications remain visible until the source workflow is completed.
 */
export function useSidebarNotifications(userId: string, pathname: string) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SidebarNotificationRow[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("app_notifications")
      .select("id, href, category, action_required, is_read, resolved_at")
      .eq("recipient_user_id", userId)
      .or("and(action_required.eq.true,resolved_at.is.null),and(action_required.eq.false,is_read.eq.false)")
      .order("created_at", { ascending: false });

    if (error) {
      // Missing migration / permission errors should not break the workspace UI.
      console.error("Gagal memuat notifikasi sidebar:", error.message);
      return;
    }

    setRows((data ?? []) as SidebarNotificationRow[]);
  }, [supabase, userId]);

  useEffect(() => {
    void loadNotifications();

    if (!userId) return;

    const channel = supabase
      .channel(`app-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase, userId]);

  // Opening a page clears only informational/unread badges. Work items remain
  // counted until their source record changes to a completed status in SQL.
  useEffect(() => {
    const currentPath = normalizePath(pathname);
    const ids = rows
      .filter(
        (row) =>
          !row.action_required &&
          !row.is_read &&
          normalizePath(row.href) === currentPath,
      )
      .map((row) => row.id);

    if (ids.length === 0) return;

    setRows((current) =>
      current.map((row) => (ids.includes(row.id) ? { ...row, is_read: true } : row)),
    );

    void (supabase as any)
      .from("app_notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", userId)
      .in("id", ids)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error("Gagal menandai notifikasi dibaca:", error.message);
      });
  }, [pathname, rows, supabase, userId]);

  return useMemo(() => {
    const counts: SidebarNotificationCounts = {};
    for (const row of rows) {
      if (!isActiveNotification(row)) continue;
      const href = normalizePath(row.href);
      counts[href] = (counts[href] ?? 0) + 1;
    }
    return counts;
  }, [rows]);
}

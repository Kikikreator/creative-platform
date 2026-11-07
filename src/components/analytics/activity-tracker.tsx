"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Records authenticated page views only.
 * The database policy limits inserts to the current user's own activity row.
 */
export default function ActivityTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/_next")) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    let cancelled = false;

    async function recordPageView() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled || authError || !user) return;

        const { error } = await (supabase as any)
          .from("platform_activity_logs")
          .insert({
            user_id: user.id,
            event_type: "page_view",
            path: pathname,
            metadata: {},
          });

        if (error) {
          // Activity logging must never interrupt normal navigation.
          console.warn("Aktivitas halaman belum tercatat:", error.message);
        }
      } catch (error) {
        console.warn("Gagal mencatat aktivitas halaman:", error);
      }
    }

    void recordPageView();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}

import { createClient } from "@/lib/supabase/server";

export type PlatformActivityLog = {
  id: number;
  user_id: string;
  event_type: string;
  path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ActivityProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export async function getPlatformActivity() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await (supabase as any)
    .from("platform_activity_logs")
    .select("id, user_id, event_type, path, metadata, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const activityLogs = (logs ?? []) as PlatformActivityLog[];
  const userIds = Array.from(new Set(activityLogs.map((item) => item.user_id)));

  let profiles: ActivityProfile[] = [];
  let profilesError: string | null = null;

  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    profiles = (data ?? []) as ActivityProfile[];
    profilesError = error?.message ?? null;
  }

  return {
    logs: activityLogs,
    profiles,
    error: [logsError?.message, profilesError].filter(Boolean).join(" · ") || null,
  };
}

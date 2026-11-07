import { getPlatformActivity } from "@/lib/analytics/platform-activity";
import ActivityDashboard from "@/components/admin/activity-dashboard";

export default async function AdminActivityPage() {
  const { logs, profiles, error } = await getPlatformActivity();
  return (
    <ActivityDashboard
      logs={logs}
      profiles={profiles}
      error={error}
      mode="logs"
    />
  );
}

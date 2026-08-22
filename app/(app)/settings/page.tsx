import { requireUser } from "@/lib/auth/require-user";
import { SettingsPanels } from "@/components/settings/settings-panels";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <SettingsPanels user={{ name: user.name, email: user.email, currency: user.currency }} />
  );
}

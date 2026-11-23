import { getDb } from '@/db';
import { getPrefs } from '@/lib/prefs';
import { requireUser } from '@/server/session';
import { SettingsView } from './SettingsView';

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = await getPrefs(await getDb(), user.id);
  return <SettingsView initial={prefs} />;
}

import { requireAdmin } from '@/server/session';
import { AdminNav } from './AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-stack">
      <AdminNav />
      {children}
    </main>
  );
}

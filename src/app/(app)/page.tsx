import { requireUser } from '@/server/session';

export default async function Home() {
  const user = await requireUser();
  return <main className="page"><p>{user.name}님 환영합니다.</p></main>;
}

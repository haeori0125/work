import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/session';
import { kstDate, kstWeekday } from '@/lib/time';
import { isXmasSeason } from '@/lib/season';
import '@fontsource/great-vibes/latin-400.css';
import { Snow } from '@/app/_ui/Snow';
import { XmasTitle } from '@/app/_ui/XmasTitle';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ out?: string }> }) {
  if (await getCurrentUser()) redirect('/');
  const out = (await searchParams).out === '1';
  const d = kstDate(new Date());
  const stamp = { date: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, day: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][kstWeekday(d)] };
  const xmas = isXmasSeason(d);
  return (
    <main className="auth-page">
      {xmas && <Snow />}
      {xmas && <XmasTitle />}
      <div className="auth-col">
        <LoginForm stamp={stamp} notice={out ? '퇴근했습니다. 수고하셨어요! 다시 일할 때 로그인하면 새로 출근이 기록됩니다.' : null} />
      </div>
    </main>
  );
}

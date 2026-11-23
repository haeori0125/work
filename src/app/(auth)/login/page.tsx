import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ out?: string }> }) {
  if (await getCurrentUser()) redirect('/');
  const out = (await searchParams).out === '1';
  return <main className="auth-page"><LoginForm notice={out ? '퇴근했습니다. 수고하셨어요! 다시 일할 때 로그인하면 새로 출근이 기록됩니다.' : null} /></main>;
}

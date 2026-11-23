import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');
  return <main className="auth-page"><LoginForm /></main>;
}

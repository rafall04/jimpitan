/**
 * Purpose: Login page scaffold.
 * Caller: App Router route at /login.
 * Deps: LoginForm feature component.
 * MainFuncs: Renders the safe auth form shell without token persistence logic.
 * SideEffects: None.
 */
import { LoginForm } from '@/features/auth/login-form';

export const metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return <LoginForm />;
}

/**
 * Purpose: Accessible login form shell wired to the API client.
 * Caller: Login page route.
 * Deps: React Hook Form, Zod resolver, API client, shadcn-compatible inputs, and toast.
 * MainFuncs: Validates credentials, calls configured backend auth, and establishes secure session cookies.
 * SideEffects: Sends login request and navigates after success.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/lib/api/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginFormSchema, type LoginFormValues } from './login.schema';
import { useLoginMutation } from './use-session';

export function LoginForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [requiresTenant, setRequiresTenant] = useState(false);
  const [nextPath] = useState(() => (typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('next')));
  const loginMutation = useLoginMutation(nextPath);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: '',
      password: '',
      rtId: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      await loginMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setRequiresTenant(true);
      }
      setFormError(error instanceof ApiError ? error.message : 'Login failed. Try again.');
    }
  }

  return (
    <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm" aria-labelledby="login-title">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">JIMPITAN RT</p>
        <h1 id="login-title" className="mt-2 text-2xl font-semibold">
          Staff login
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your registered RT account to continue.</p>
      </div>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">Email, phone, or username</Label>
          <Input id="identifier" type="text" autoComplete="username" {...form.register('identifier')} aria-invalid={Boolean(form.formState.errors.identifier)} />
          {form.formState.errors.identifier ? <p className="text-sm text-destructive">{form.formState.errors.identifier.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} aria-invalid={Boolean(form.formState.errors.password)} />
          {form.formState.errors.password ? <p className="text-sm text-destructive">{form.formState.errors.password.message}</p> : null}
        </div>
        {requiresTenant ? (
          <div className="space-y-2">
            <Label htmlFor="rtId">RT identifier</Label>
            <Input id="rtId" type="text" autoComplete="off" {...form.register('rtId')} aria-invalid={Boolean(form.formState.errors.rtId)} />
            {form.formState.errors.rtId ? <p className="text-sm text-destructive">{form.formState.errors.rtId.message}</p> : null}
          </div>
        ) : null}
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </section>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  redirectTo: string;
  labels: { identifier: string; password: string; submit: string; error: string };
}

export function LoginForm({ redirectTo, labels }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    // Posts to our own route handler, not the API: it exchanges the credentials
    // for tokens and stores them in httpOnly cookies the browser cannot read.
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: form.get('identifier'),
        password: form.get('password'),
      }),
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const message = (body as { error?: { message?: string } } | null)?.error?.message;
      setError(message ?? labels.error);
      setPending(false);
      return;
    }

    router.push(redirectTo);
    // Server components hold the old signed-out state until this refresh.
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="identifier">{labels.identifier}</Label>
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {labels.submit}
      </Button>
    </form>
  );
}

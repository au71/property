'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Props {
  labels: {
    name: string;
    email: string;
    phone: string;
    password: string;
    intent: string;
    intentSeeker: string;
    intentOwner: string;
    intentAgent: string;
    submit: string;
    error: string;
  };
}

export function RegisterForm({ labels }: Props) {
  const router = useRouter();
  const [intent, setIntent] = useState('SEEKER');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email') || undefined,
        phone: form.get('phone') || undefined,
        password: form.get('password'),
        intent,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
      } | null;
      const details = body?.error?.details;
      if (Array.isArray(details)) {
        const map: Record<string, string> = {};
        for (const issue of details) {
          if (issue.path && issue.message) map[issue.path] ??= issue.message;
        }
        setFieldErrors(map);
      }
      setError(body?.error?.message ?? labels.error);
      setPending(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="name" label={labels.name} autoComplete="name" required error={fieldErrors['name']} />
      <Field
        id="email"
        label={labels.email}
        type="email"
        autoComplete="email"
        error={fieldErrors['email']}
      />
      <Field
        id="phone"
        label={labels.phone}
        type="tel"
        autoComplete="tel"
        placeholder="09xxxxxxxxx"
        error={fieldErrors['phone']}
      />
      <Field
        id="password"
        label={labels.password}
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors['password']}
      />

      <div className="space-y-1.5">
        <Label htmlFor="intent">{labels.intent}</Label>
        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger id="intent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEEKER">{labels.intentSeeker}</SelectItem>
            <SelectItem value="OWNER">{labels.intentOwner}</SelectItem>
            <SelectItem value="AGENT">{labels.intentAgent}</SelectItem>
          </SelectContent>
        </Select>
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

function Field({
  id,
  label,
  error,
  className,
  ...props
}: React.ComponentProps<'input'> & { label: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(className)}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

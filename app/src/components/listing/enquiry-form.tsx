'use client';

import { useState } from 'react';
import { IconCircleCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiFetch } from '@/lib/api/client';

interface Props {
  listingRef: string;
  labels: {
    name: string;
    phone: string;
    email: string;
    message: string;
    send: string;
    sent: string;
    sentHint: string;
    error: string;
  };
}

export function EnquiryForm({ listingRef, labels }: Props) {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      await apiFetch(`/listings/${encodeURIComponent(listingRef)}/enquiries`, {
        method: 'POST',
        body: {
          name: form.get('name'),
          phone: form.get('phone'),
          email: form.get('email') || undefined,
          message: form.get('message'),
          // Matches the API's honeypot field: a real person never fills this in.
          website: form.get('website') || undefined,
        },
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
      } else {
        setError(labels.error);
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-4 rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <IconCircleCheck className="size-5 text-success" aria-hidden />
          {labels.sent}
        </p>
        <p className="mt-1 text-muted-foreground">{labels.sentHint}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <Field id="name" name="name" label={labels.name} required error={fieldErrors['name']} />
      <Field
        id="phone"
        name="phone"
        type="tel"
        label={labels.phone}
        required
        error={fieldErrors['phone']}
      />
      <Field id="email" name="email" type="email" label={labels.email} error={fieldErrors['email']} />

      <div className="space-y-1.5">
        <Label htmlFor="message">{labels.message}</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={4}
          aria-invalid={!!fieldErrors['message']}
          aria-describedby={fieldErrors['message'] ? 'message-error' : undefined}
        />
        {fieldErrors['message'] && (
          <p id="message-error" className="text-xs text-destructive">
            {fieldErrors['message']}
          </p>
        )}
      </div>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {labels.send}
      </Button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = 'text',
  required,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

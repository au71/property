'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhone, normalizePhone } from '@/lib/auth/phone';

/**
 * Sign in with a phone number and a six-digit code.
 *
 * Two steps, one component: the number is needed to ask for a code and again to
 * verify it, and keeping it in state avoids a round trip through the URL where
 * it would end up in browser history and server logs.
 *
 * Whether the number already has an account is deliberately not knowable from
 * here — the request endpoint answers identically either way so it cannot be
 * used to test which numbers are registered — so the name field is offered to
 * everyone and ignored for an account that already has one.
 */

/** Matches OTP_RESEND_SECONDS in the API, which sends nothing sooner than this. */
const RESEND_SECONDS = 60;

export interface OtpLabels {
  phone: string;
  phoneHint: string;
  sendCode: string;
  code: string;
  codeSentTo: string;
  name: string;
  nameHint: string;
  verify: string;
  resend: string;
  resendIn: string;
  changeNumber: string;
  invalidPhone: string;
  error: string;
}

interface Props {
  redirectTo: string;
  labels: OtpLabels;
}

export function OtpLoginForm({ redirectTo, labels }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // The code field only exists once a number has been submitted, so focus it
  // then rather than on every render of the step.
  useEffect(() => {
    if (phone) codeRef.current?.focus();
  }, [phone]);

  async function post(path: string, body: unknown): Promise<boolean> {
    setPending(true);
    setError(null);

    // Our own route handler, not the API: it puts the tokens into httpOnly
    // cookies rather than handing them to this script.
    const response = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message = (payload as { error?: { message?: string } } | null)?.error?.message;
      setError(message ?? labels.error);
      setPending(false);
      return false;
    }

    setPending(false);
    return true;
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = String(new FormData(event.currentTarget).get('phone') ?? '');
    const normalized = normalizePhone(typed);
    if (!normalized) {
      setError(labels.invalidPhone);
      return;
    }

    if (await post('otp/request', { phone: normalized })) {
      setPhone(normalized);
      setSecondsLeft(RESEND_SECONDS);
    }
  }

  async function resend() {
    if (!phone || secondsLeft > 0) return;
    if (await post('otp/request', { phone })) setSecondsLeft(RESEND_SECONDS);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();

    const ok = await post('otp/verify', {
      phone,
      code: String(form.get('code') ?? '').trim(),
      ...(name ? { name } : {}),
    });
    if (!ok) return;

    router.push(redirectTo);
    // Server components hold the old signed-out state until this refresh.
    router.refresh();
  }

  if (!phone) {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otp-phone">{labels.phone}</Label>
          <Input
            id="otp-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xxxxxxxxx"
            aria-invalid={!!error}
            required
          />
          <p className="text-xs text-muted-foreground">{labels.phoneHint}</p>
        </div>

        <ErrorMessage error={error} />

        <Button type="submit" className="w-full" disabled={pending}>
          {labels.sendCode}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="otp-code">{labels.code}</Label>
        <Input
          id="otp-code"
          name="code"
          ref={codeRef}
          inputMode="numeric"
          // Lets a phone browser lift the code straight out of the SMS.
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          className="text-center text-lg tracking-[0.4em]"
          aria-invalid={!!error}
          required
        />
        <p className="text-xs text-muted-foreground">
          {labels.codeSentTo} <span className="font-medium">{formatPhone(phone)}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="otp-name">{labels.name}</Label>
        <Input id="otp-name" name="name" autoComplete="name" />
        <p className="text-xs text-muted-foreground">{labels.nameHint}</p>
      </div>

      <ErrorMessage error={error} />

      <Button type="submit" className="w-full" disabled={pending}>
        {labels.verify}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hover:underline"
          onClick={() => {
            setPhone(null);
            setError(null);
            setSecondsLeft(0);
          }}
        >
          {labels.changeNumber}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={pending || secondsLeft > 0}
          className="font-medium hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {secondsLeft > 0 ? labels.resendIn.replace('{seconds}', String(secondsLeft)) : labels.resend}
        </button>
      </div>
    </form>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}

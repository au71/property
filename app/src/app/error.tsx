'use client';

import { useEffect } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where Sentry (or equivalent) would receive it.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <IconAlertTriangle className="size-12 text-warning" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page could not be loaded. This is usually temporary.
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

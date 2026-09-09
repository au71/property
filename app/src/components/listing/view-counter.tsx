'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

/**
 * Records a view once per mount. Fire-and-forget: a failed counter must never
 * surface an error on a page that otherwise rendered perfectly well.
 */
export function ViewCounter({ reference, enabled }: { reference: string; enabled: boolean }) {
  const counted = useRef(false);

  useEffect(() => {
    if (!enabled || counted.current) return;
    counted.current = true;
    void apiFetch(`/listings/${encodeURIComponent(reference)}/view`, { method: 'POST' }).catch(
      () => undefined,
    );
  }, [reference, enabled]);

  return null;
}

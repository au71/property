'use client';

import { useState } from 'react';
import { IconBrandLine, IconLoader2, IconPhone, IconRosetteDiscountCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api/client';

interface Contact {
  name?: string;
  hasPhone?: boolean;
  hasViber?: boolean;
}

interface Props {
  listingRef: string;
  contact: Contact;
  owner: {
    name?: string;
    agentProfile?: { agencyName?: string | null; isVerifiedAgent?: boolean } | null;
  } | null;
  labels: { contact: string; showPhone: string; enquire: string; error: string };
}

interface Revealed {
  name: string;
  phone: string;
  viber?: string | null;
}

/**
 * The phone number is fetched on click, never passed in as a prop.
 *
 * Anything handed to a client component is serialised into the server-rendered
 * payload, so a number passed down "for the reveal button" is already sitting
 * in the page source where a scraper reads it without ever clicking. Fetching
 * on demand keeps it out of the HTML and makes harvesting the catalogue cost
 * one rate-limited request per listing.
 */
export function ContactCard({ listingRef, contact, owner, labels }: Props) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agency = owner?.agentProfile;

  async function reveal() {
    setPending(true);
    setError(null);
    try {
      setRevealed(
        await apiFetch<Revealed>(`/listings/${encodeURIComponent(listingRef)}/contact`),
      );
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {labels.contact}
        </p>
        <p className="mt-1 font-semibold">{contact.name || owner?.name}</p>

        {agency?.agencyName && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            {agency.agencyName}
            {agency.isVerifiedAgent && (
              <IconRosetteDiscountCheck
                className="size-4 text-success"
                aria-label="Verified agent"
              />
            )}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {revealed ? (
            <>
              <Button asChild className="w-full">
                <a href={`tel:${revealed.phone}`}>
                  <IconPhone />
                  {revealed.phone}
                </a>
              </Button>
              {revealed.viber && (
                <Button variant="outline" asChild className="w-full">
                  <a href={`viber://chat?number=${encodeURIComponent(revealed.viber)}`}>
                    <IconBrandLine />
                    Viber
                  </a>
                </Button>
              )}
            </>
          ) : (
            contact.hasPhone && (
              <Button className="w-full" onClick={() => void reveal()} disabled={pending}>
                {pending ? <IconLoader2 className="animate-spin" /> : <IconPhone />}
                {labels.showPhone}
              </Button>
            )
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

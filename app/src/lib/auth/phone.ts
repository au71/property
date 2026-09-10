/**
 * Myanmar mobile numbers, as people actually type them.
 *
 * A number is written `09xxxxxxxxx` locally and `+959xxxxxxxxx` abroad, often
 * with spaces or dashes in between. The API normalises to the `+95` form and
 * rejects anything else; doing the same here means a mistyped number is caught
 * before it costs an SMS, and the value sent is the one the API stores.
 *
 * Deliberately free of React and of `server-only`: the sign-in form runs this in
 * the browser, and the unit tests run it in neither.
 */

/**
 * The same shape the API's `phoneSchema` accepts: a `+95`, `95` or `0` prefix,
 * then a subscriber number starting with 9. Keep the two in step, or the form
 * will happily send numbers the API then rejects.
 */
const ACCEPTED = /^(?:95|0)(9\d{7,10})$/;

/** Returns the number in `+959…` form, or null if it is not a Myanmar mobile. */
export function normalizePhone(raw: string): string | null {
  const match = ACCEPTED.exec(raw.replace(/\D/g, ''));
  return match ? `+95${match[1]}` : null;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * The local `09…` form, grouped, for reading back to someone who has just typed
 * it. Anything unrecognised is returned untouched rather than mangled.
 */
export function formatPhone(value: string): string {
  const normalized = normalizePhone(value);
  if (!normalized) return value;

  const local = `0${normalized.slice(3)}`;
  return local.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, '$1 $2 $3 $4').trim();
}

/**
 * "* שדה חובה" — the key to the red asterisks a form marks its mandatory
 * fields with.
 *
 * Sighted users infer the convention from the asterisk alone most of the time,
 * but not everyone does, and a form that never says what the mark means is
 * asking the reader to guess. One line at the top of the form costs nothing
 * and removes the guess.
 *
 * Not aria-hidden: unlike the asterisks themselves this reads as a sentence,
 * and hearing it once before the fields sets the same expectation it sets
 * visually.
 */
export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-[var(--color-ink-muted)] ${className ?? ""}`}>
      <span className="text-destructive">*</span> שדה חובה
    </p>
  );
}

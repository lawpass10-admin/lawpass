import { cn } from "@/lib/utils";
import type { QuestionEditorChoice } from "@/lib/db/admin";

/**
 * Read-only context block — the question text and its 4 choices, with
 * the correct one marked. Renders at the top of each editor tab so
 * the admin can see what they're editing analyses for without
 * round-tripping back to the user-facing view.
 *
 * Question text and choices are OUT OF SCOPE for editing and stay
 * read-only here.
 */
export default function ContextBlock({
  questionText,
  choices,
}: {
  questionText: string;
  choices: QuestionEditorChoice[];
}) {
  return (
    <section
      aria-label="טקסט השאלה והאפשרויות (לקריאה בלבד)"
      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-gold-tint)]/30 p-4"
    >
      <header className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
        <span>הקשר</span>
        <span aria-hidden>·</span>
        <span>קריאה בלבד</span>
      </header>
      <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
        {questionText}
      </p>
      {choices.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {choices.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 text-sm leading-relaxed"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                  c.isCorrect
                    ? "bg-[var(--color-status-strong-bg)] text-[var(--color-status-strong)]"
                    : "bg-muted text-muted-foreground"
                )}
                aria-label={c.isCorrect ? "תשובה נכונה" : undefined}
              >
                {c.letter}
              </span>
              <span dir="auto" className="text-foreground/85">
                {c.choiceText}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

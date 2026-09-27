import Link from "next/link";

import type { PickerSet } from "@/components/app/paper-list";

import { PaperChoice } from "./paper-choice";

/**
 * The page a candidate lands on before sitting a multiple-choice paper: the
 * Bar's general instructions for that part of the exam, then the choice of which
 * paper to sit.
 *
 * Shared by /diuni-start and /mahoti-start, which differ only in their part name,
 * their instructions and their papers. It replaces the picker dialog the sidebar
 * used to open: instructions are text a candidate should read before the clock
 * starts, which a modal over whatever screen they were on does not invite.
 *
 * The instructions are reproduced as printed, including the parts about the
 * physical sitting (the answer sheet, the invigilators) — the candidate meets
 * them in that form on the day.
 */
export function ExamStartPage({
  part,
  crumb,
  preamble,
  instructions,
  sets,
  customSets = [],
  examRoute,
  listLabel,
  emptyLabel,
}: {
  /** "חלק ב' – דין דיוני" */
  part: string;
  /** The subject, for the breadcrumb. */
  crumb: string;
  preamble: string;
  instructions: string[];
  sets: PickerSet[];
  /**
   * Papers this candidate built for themselves. Listed separately from the
   * authored ones because `listMahotiSets`/`listDiuniSets` deliberately
   * exclude them — without this section a custom exam was reachable only by
   * the URL the builder redirected to, and was lost the moment you navigated
   * away. Empty by default, and the section is omitted when empty.
   */
  customSets?: PickerSet[];
  /** Where the chosen paper opens, as `<examRoute>?set=<id>`. */
  examRoute: "/diuni" | "/mahoti";
  listLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
      <nav className="flex items-center gap-2 font-heebo text-sm" aria-label="פירורי לחם">
        <Link href="/dashboard" className="hover:underline" style={{ color: "var(--color-gold-deep)" }}>
          דשבורד
        </Link>
        <span aria-hidden style={{ color: "var(--color-ink-muted)" }}>
          ›
        </span>
        <span style={{ color: "var(--color-ink-dim)" }}>{crumb}</span>
      </nav>

      <article
        className="rounded-2xl border px-6 py-7 md:px-10 md:py-9"
        style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
      >
        <header className="space-y-2 border-b pb-5" style={{ borderColor: "var(--color-line)" }}>
          <h1
            className="font-heebo font-extrabold tracking-tight"
            style={{ fontSize: "clamp(24px, 2.2vw, 32px)", color: "var(--color-navy-ink)", lineHeight: 1.2 }}
          >
            הנחיות כלליות לביצוע המבחן
          </h1>
          <p className="font-heebo font-bold" style={{ fontSize: 18, color: "var(--color-gold-deep)" }}>
            {part}
          </p>
        </header>

        <p className="mt-5 font-heebo" style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--color-ink-dim)" }}>
          {preamble}
        </p>

        <ol className="mt-5 space-y-3.5">
          {instructions.map((text, i) => (
            <li
              key={i}
              className="flex gap-3 font-heebo"
              style={{ fontSize: 16, lineHeight: 1.85, color: "var(--color-ink)" }}
            >
              <span
                aria-hidden
                className="mt-[0.2em] flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                style={{ background: "var(--muted, #f2f4f7)", color: "var(--color-navy-ink)" }}
              >
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <p
          className="mt-8 text-center font-heebo font-extrabold"
          style={{ fontSize: 22, letterSpacing: "0.35em", color: "var(--color-navy-ink)" }}
        >
          בהצלחה
        </p>
      </article>

      <PaperChoice sets={sets} examRoute={examRoute} listLabel={listLabel} emptyLabel={emptyLabel} />

      {customSets.length > 0 ? (
        <PaperChoice
          sets={customSets}
          examRoute={examRoute}
          heading="השאלונים שבניתי"
          listLabel="השאלונים שבניתי"
          emptyLabel=""
        />
      ) : null}
    </div>
  );
}

/*
 * The instruction text common to both parts, as printed on the paper.
 *
 * The source PDF's font drops the letter נ (the defect hebrew_pdf_to_json.py
 * reports as DEFECT 5), so the extracted copy read "וחות", "הבחיה", "ממו",
 * "לפי השעה". It is restored here letter for letter — נוחות, הבחינה, ממנו,
 * לפני השעה — along with the year and minutes the bidi extraction turned round
 * ("התשכ"ג- ,1962", "ו40- דק'"). Nothing else is reworded.
 */

export const INSTRUCTIONS_PREAMBLE =
  "מטעמי נוחות בלבד ההוראות כאן ובתוך מחברת הבחינה מנוסחות בלשון זכר, והן מיועדות לגברים ונשים כאחד.";

export const INSTRUCTION_ANSWER_ALL =
  'ענה על כל השאלות. השאלות מנוסחות בשיטת "המבחן האמריקאי". לכל שאלה ארבע תשובות, עליך לסמן את התשובה הנכונה ביותר.';

export const INSTRUCTION_ANSWER_SHEET =
  "לתשומת לבך, רק התשובה המסומנת ב-X בדף התשובות, והיא בלבד, תיקרא על-ידי המחשב כתשובתך לשאלה.";

export const INSTRUCTION_CHEATING =
  'בהתאם לתקנות לשכת עורכי-הדין (סדרי בחינות בדיני מדינת ישראל, באתיקה מקצועית החלה על עורכי דין זרים ובבחינת ההסמכה לעריכת דין), התשכ"ג-1962, צפוי מתמחה שיעתיק בבחינה או ימצא עם טלפון נייד כהגדרתו בגוף ההוראות להוצאתו מחדר הבחינות או לפסילת הבחינה, וניתן לשלול ממנו לגשת לבחינה במועד אחר. כמו כן, ובהתאם להוראות סעיף 41 לחוק הלשכה, יינקטו הליכים כנגד המעתיקים במישור המשמעתי.';

export const INSTRUCTION_INVIGILATORS = "הנך נדרש להישמע להוראות המפקחים בעת הבחינה.";

"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

import {
  LOCKED_OVERLAY_BY_PANE_KEY,
  badFeedbackParts,
  trySectionCopy,
  tryQuestions,
  type ChoiceLetter,
  type LockedPane,
  type PaneKey,
  type QuestionCopy,
  type UnlockedPane,
} from "@/app/(marketing)/_components/landing-try-copy";

import styles from "./landing.module.css";

/**
 * Slice 48 — `#try` simulator (Client island).
 *
 * Single "use client" component that owns ALL the interactive state for the
 * 3-question sample block. Faithful port of the design's vanilla JS in
 * `_design/landing-hifi-new.html` lines 1813–1866.
 *
 *   1) qtab row → which of the 3 cards is visible
 *   2) `<button class="ts-opt">` click → marks the card "is-answered", reveals
 *      feedback + the 360° toggle. The design's script does NOT re-allow a
 *      second pick (`if (card.classList.contains('is-answered')) return;`);
 *      we mirror that — once answered, stays answered.
 *   3) `.ts-360toggle` click → opens / closes the 360° panel; flips the
 *      chevron via the `is-360open` modifier on the card and the toggle
 *      label between "הצג"/"הסתר".
 *   4) `.t360-tab` click → activates that pane. Per PM lock §C the design's
 *      UX is preserved: locked-tab clicks DO switch the pane and show the
 *      blurred + overlay teaser. The script does not block locked-tab
 *      clicks; we mirror that.
 *
 * State shape: one `CardState` per question card, kept in a fixed-length
 * tuple so the type checker can prove indexing safety. `activeQ` lives
 * separately at the top level (which card the qtab row is pointing at).
 *
 * SVG icons are inlined as small helper components below — no public/ assets
 * (per Slice 48 brief: "all inline SVG, no new public/ files").
 *
 * `aria-label` on the qtabs container is preserved per PM lock §F:
 * `"בחירת שאלת תרגול"`.
 */

type CardState = {
  /** null until the user clicks an option; then never reverts. */
  answered: { picked: ChoiceLetter; correct: boolean } | null;
  /** Whether the 360° analysis panel is expanded. */
  is360open: boolean;
  /** Which 360° pane is showing inside the panel. */
  activeTab: PaneKey;
};

const INITIAL_CARD: CardState = {
  answered: null,
  is360open: false,
  activeTab: "topic",
};

/** Concat helper — drops falsy values so we can pass conditional class refs. */
function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

// ─── Tabs row config (kept stable; mirrors the design's button order
//     across all 3 Qs per PM lock §E: distractors → trap → angles →
//     summary across all 3 Qs). ─────────────────────────────────────────
const TAB_ORDER: ReadonlyArray<{ key: PaneKey; locked: boolean }> = [
  { key: "topic", locked: false },
  { key: "explain", locked: false },
  { key: "refs", locked: false },
  { key: "distractors", locked: true },
  { key: "trap", locked: true },
  { key: "angles", locked: true },
  { key: "summary", locked: true },
];

export function LandingTryClient() {
  const [activeQ, setActiveQ] = useState<0 | 1 | 2>(0);
  const [cards, setCards] = useState<[CardState, CardState, CardState]>([
    { ...INITIAL_CARD },
    { ...INITIAL_CARD },
    { ...INITIAL_CARD },
  ]);

  const updateCard = (i: 0 | 1 | 2, patch: Partial<CardState>) => {
    setCards((prev) => {
      const next: [CardState, CardState, CardState] = [
        prev[0],
        prev[1],
        prev[2],
      ];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const handlePick = (i: 0 | 1 | 2, letter: ChoiceLetter) => {
    if (cards[i].answered) return; // mirrors design's "no second pick"
    const q = tryQuestions[i];
    updateCard(i, {
      answered: { picked: letter, correct: letter === q.correctLetter },
    });
  };

  const handleToggle360 = (i: 0 | 1 | 2) => {
    updateCard(i, { is360open: !cards[i].is360open });
  };

  const handleTabClick = (i: 0 | 1 | 2, key: PaneKey) => {
    updateCard(i, { activeTab: key });
  };

  return (
    <>
      <div
        className={styles.tsQtabs}
        role="tablist"
        aria-label={trySectionCopy.qtabsAriaLabel}
      >
        {tryQuestions.map((q, i) => (
          <button
            key={q.qtabLabel}
            type="button"
            role="tab"
            className={cx(styles.tsQtab, activeQ === i && styles.isActive)}
            onClick={() => setActiveQ(i as 0 | 1 | 2)}
            aria-selected={activeQ === i}
          >
            <span className={styles.tsQtabNum}>{i + 1}</span>
            {q.qtabLabel}
          </button>
        ))}
      </div>

      {tryQuestions.map((q, i) => (
        <QuestionCard
          key={q.qtabLabel}
          index={i as 0 | 1 | 2}
          q={q}
          state={cards[i]}
          isActive={activeQ === i}
          onPick={(letter) => handlePick(i as 0 | 1 | 2, letter)}
          onToggle360={() => handleToggle360(i as 0 | 1 | 2)}
          onTabClick={(key) => handleTabClick(i as 0 | 1 | 2, key)}
        />
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Card
// ───────────────────────────────────────────────────────────────────────

function QuestionCard(props: {
  index: 0 | 1 | 2;
  q: QuestionCopy;
  state: CardState;
  isActive: boolean;
  onPick: (letter: ChoiceLetter) => void;
  onToggle360: () => void;
  onTabClick: (key: PaneKey) => void;
}) {
  const { q, state, isActive, onPick, onToggle360, onTabClick } = props;
  const answered = state.answered;
  const isAnswered = answered !== null;

  return (
    <article
      className={cx(
        styles.tsCard,
        isActive && styles.isActive,
        isAnswered && styles.isAnswered,
        state.is360open && styles.is360open
      )}
    >
      <div className={styles.tsCardpad}>
        <div className={styles.tsTopicbar}>
          <span className={styles.tsCrumb}>{q.crumb}</span>
          <span className={styles.tsTag}>{q.tag}</span>
        </div>
        <p className={styles.tsQuestion}>{q.stem}</p>

        <ul className={styles.tsOptions}>
          {q.choices.map((choice) => {
            const isCorrect = isAnswered && choice.letter === q.correctLetter;
            const isWrong =
              isAnswered &&
              answered!.picked === choice.letter &&
              !answered!.correct;
            return (
              <li key={choice.letter}>
                <button
                  type="button"
                  className={cx(
                    styles.tsOpt,
                    isCorrect && styles.isCorrect,
                    isWrong && styles.isWrong
                  )}
                  onClick={() => onPick(choice.letter)}
                  disabled={isAnswered}
                >
                  <span className={styles.tsOptLetter}>{choice.letter}</span>
                  <span className={styles.tsOptText}>{choice.text}</span>
                  <span className={styles.tsOptMark}>
                    {isCorrect ? <CheckMarkIcon /> : <XMarkIcon />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <FeedbackBlock answered={answered} correctLetter={q.correctLetter} />

        <ToggleButton open={state.is360open} onClick={onToggle360} />

        <Panel360
          q={q}
          open={state.is360open}
          activeTab={state.activeTab}
          onTabClick={onTabClick}
        />
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Feedback ribbon (good / bad)
// ───────────────────────────────────────────────────────────────────────

function FeedbackBlock(props: {
  answered: CardState["answered"];
  correctLetter: ChoiceLetter;
}) {
  const { answered, correctLetter } = props;
  if (!answered) {
    // Even when unanswered we render the empty container, mirroring the
    // design where the `.ts-feedback` element exists in the DOM and is
    // toggled visible via `.ts-card.is-answered .ts-feedback { display:
    // block; }`. Keeping the container in place avoids a layout jump on
    // first answer.
    return <div className={styles.tsFeedback} />;
  }
  if (answered.correct) {
    return (
      <div className={cx(styles.tsFeedback, styles.isGood)}>
        <div className={styles.tsFb}>
          <div className={styles.tsFeedbackTitle}>
            {trySectionCopy.feedback.goodTitle}
          </div>
          <div className={styles.tsFeedbackSub}>
            {trySectionCopy.feedback.goodSub}
          </div>
        </div>
      </div>
    );
  }
  const { pre, post } = badFeedbackParts();
  return (
    <div className={cx(styles.tsFeedback, styles.isBad)}>
      <div className={styles.tsFb}>
        <div className={styles.tsFeedbackTitle}>
          {trySectionCopy.feedback.badTitle}
        </div>
        <div className={styles.tsFeedbackSub}>
          {pre}
          <strong>{correctLetter}</strong>
          {post}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// 360° toggle button + 360° panel
// ───────────────────────────────────────────────────────────────────────

function ToggleButton(props: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.ts360Toggle}
      onClick={props.onClick}
      aria-expanded={props.open}
    >
      <span className={styles.ts360ToggleLabel}>
        {props.open
          ? trySectionCopy.panel360.toggleOpenLabel
          : trySectionCopy.panel360.toggleClosedLabel}
      </span>
      <ChevronIcon />
    </button>
  );
}

function Panel360(props: {
  q: QuestionCopy;
  open: boolean;
  activeTab: PaneKey;
  onTabClick: (key: PaneKey) => void;
}) {
  const { q, open, activeTab, onTabClick } = props;
  const correctChoice = q.choices.find((c) => c.letter === q.correctLetter)!;
  const correctTitle = trySectionCopy.panel360.correctBannerTitleTemplate.replace(
    "{LETTER}",
    q.correctLetter
  );
  return (
    <div className={cx(styles.ts360, open && styles.isOpen)}>
      <div className={styles.ts360Head}>
        <span className={styles.ts360Badge}>
          {trySectionCopy.panel360.badge}
        </span>
        <span className={styles.ts360Title}>
          {trySectionCopy.panel360.title}
        </span>
      </div>

      <div className={styles.ts360Correct}>
        <span className={styles.ts360CorrectIco}>
          <CheckMarkIcon />
        </span>
        <div>
          <div className={styles.ts360CorrectTtl}>{correctTitle}</div>
          <div className={styles.ts360CorrectTxt}>{correctChoice.text}</div>
        </div>
      </div>

      <div className={styles.ts360Tabs} role="tablist">
        {TAB_ORDER.map(({ key, locked }) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={cx(
              styles.t360Tab,
              locked && styles.isLocked,
              activeTab === key && styles.isActive
            )}
            onClick={() => onTabClick(key)}
            aria-selected={activeTab === key}
          >
            {locked ? <SmallLockIcon /> : null}
            {trySectionCopy.tabLabels[key]}
          </button>
        ))}
      </div>

      {TAB_ORDER.map(({ key, locked }) => {
        const isActive = activeTab === key;
        if (locked) {
          const lockedPane = q.locked[key as "distractors" | "trap" | "angles" | "summary"];
          return (
            <div
              key={key}
              className={cx(styles.t360Pane, isActive && styles.isActive)}
            >
              <LockedPaneBlock
                pane={lockedPane}
                paneKey={key as "distractors" | "trap" | "angles" | "summary"}
              />
            </div>
          );
        }
        // unlocked
        const unlocked = q.unlocked.find((u) => u.kind === key)!;
        return (
          <div
            key={key}
            className={cx(styles.t360Pane, isActive && styles.isActive)}
          >
            <UnlockedPaneBlock pane={unlocked} />
          </div>
        );
      })}
    </div>
  );
}

function UnlockedPaneBlock({ pane }: { pane: UnlockedPane }) {
  if (pane.kind === "topic") {
    return (
      <>
        <h4 className={styles.t360SecTitle}>
          <span className={styles.t360SecIco}>
            <TopicIcon />
          </span>
          {pane.title}
        </h4>
        <p className={styles.t360Text}>{pane.body}</p>
      </>
    );
  }
  if (pane.kind === "explain") {
    return (
      <>
        <h4 className={styles.t360SecTitle}>
          <span className={styles.t360SecIco}>
            <ExplainIcon />
          </span>
          {pane.title}
        </h4>
        <p className={styles.t360Text}>{pane.body}</p>
      </>
    );
  }
  // refs
  return (
    <>
      <h4 className={styles.t360SecTitle}>
        <span className={styles.t360SecIco}>
          <RefsIcon />
        </span>
        {pane.title}
      </h4>
      <ul className={styles.t360Refs}>
        {pane.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </>
  );
}

function LockedPaneBlock(props: {
  pane: LockedPane;
  paneKey: "distractors" | "trap" | "angles" | "summary";
}) {
  const { pane, paneKey } = props;
  const overlay = LOCKED_OVERLAY_BY_PANE_KEY[paneKey];
  return (
    <div className={styles.t360Locked}>
      <div className={styles.t360LockedContent} aria-hidden>
        <LockedBody pane={pane} />
      </div>
      <div className={styles.t360LockedOverlay}>
        <div className={styles.t360LockBadge}>
          <LockBadgeIcon />
        </div>
        <div className={styles.t360LockedTitle}>{overlay.title}</div>
        <div className={styles.t360LockedSub}>{overlay.sub}</div>
        <Link
          className={styles.t360LockedCta}
          href={trySectionCopy.unlockCta.href}
        >
          {trySectionCopy.unlockCta.label}
        </Link>
      </div>
    </div>
  );
}

function LockedBody({ pane }: { pane: LockedPane }) {
  if (pane.body.kind === "distractors") {
    // No leading h4 in the design for distractors — just the per-choice rows.
    return (
      <>
        {pane.body.rows.map((row) => (
          <p
            key={row.letter}
            className={styles.t360Text}
            style={{ marginBottom: 10 }}
          >
            <strong>
              {row.letter} ({row.verdict}):
            </strong>{" "}
            {row.body}
          </p>
        ))}
      </>
    );
  }
  if (pane.body.kind === "paragraph") {
    return (
      <>
        <h4 className={styles.t360SecTitle}>{pane.bodyTitle}</h4>
        <p className={styles.t360Text}>{pane.body.text}</p>
      </>
    );
  }
  // paragraphs
  return (
    <>
      <h4 className={styles.t360SecTitle}>{pane.bodyTitle}</h4>
      {pane.body.texts.map((t, idx) => (
        <Fragment key={idx}>
          <p
            className={styles.t360Text}
            style={idx > 0 ? { marginTop: 8 } : undefined}
          >
            {t}
          </p>
        </Fragment>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Inline SVG icons (all aria-hidden, all paths from the design verbatim)
// ───────────────────────────────────────────────────────────────────────

function CheckMarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

function XMarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M5 8l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function SmallLockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M4 7V5a4 4 0 018 0v2M3.5 7h9a1 1 0 011 1v5a1 1 0 01-1 1h-9a1 1 0 01-1-1V8a1 1 0 011-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function LockBadgeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 11V8a6 6 0 0112 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function TopicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M4 4h9a2 2 0 012 2v10H6a2 2 0 00-2 2V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ExplainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M10 3v14M4 6h12M5 9l-2 4h4l-2-4zm10 0l-2 4h4l-2-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M5 4h8a2 2 0 012 2v10l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

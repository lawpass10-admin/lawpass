"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import {
  A11Y_HTML_CLASS_PREFIX,
  A11Y_KEYS,
  clearPrefsCookie,
  parseClassString,
  readPrefsCookieRaw,
  writePrefsCookie,
  type A11yKey,
  type A11yPrefs,
} from "@/lib/a11y/cookie";

import styles from "./a11y-widget.module.css";

/**
 * Slice 51 — accessibility widget (Phase A) client island.
 *
 * Per the Gemini Deep Research spec the widget MUST be:
 *   - rendered via React Portal to `document.body` so it sits OUTSIDE
 *     any `body.lp-a11y-*` filter cascade (Gemini §"Accessibility of the
 *     Widget Itself" + §"No-override zone");
 *   - a real native `<button>` (no div+onClick) for the launcher AND for
 *     every toggle inside the panel (Gemini §SC 2.1.1 — Keyboard);
 *   - role="dialog" + aria-modal="true" + focus-trapped while open
 *     (Gemini §Focus Trap and Keyboard Navigation Order);
 *   - aria-haspopup="dialog" + aria-expanded on the launcher
 *     (Gemini §ARIA and Semantic Implementation);
 *   - dismissible via ESC, outside-click, AND the explicit close button,
 *     restoring focus to the launcher (Gemini §Escape and Close);
 *   - paired with an aria-live="polite" off-screen region that announces
 *     each toggle in Hebrew (Gemini §SC 4.1.3 Status Messages);
 *   - kept in sync with the cookie so a server-injected `<html>` class
 *     string and the panel's `aria-pressed` UI never drift.
 *
 * Persistence pattern mirrors `app/(marketing)/_components/cookie-bar.tsx`:
 * `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`,
 * swapping `localStorage` for `document.cookie` (per Gemini §Persistence
 * and Next.js 16 SSR Hydration Strategies — cookies, NOT localStorage).
 *
 * Note on Hebrew announcements: queueing isn't strictly necessary because
 * the user can't physically toggle two controls in the same animation
 * frame, but we still re-write the live region on every change with a
 * key bump so screen readers always announce the new state even when the
 * text hasn't changed (e.g., re-toggling the same control).
 */

const HEBREW_LABEL: Record<A11yKey, string> = {
  // Phase A
  "text-l": "טקסט גדול",
  "text-xl": "טקסט גדול מאוד",
  "contrast-high": "ניגודיות גבוהה",
  "contrast-dark": "ניגודיות כהה",
  "readable-font": "גופן קריא יותר",
  "line-height-lg": "ריווח שורות",
  "stop-motion": "עצירת אנימציות",
  // Phase B (Slice 52)
  invert: "היפוך צבעים",
  grayscale: "גווני אפור",
  "saturate-high": "רוויה גבוהה",
  "saturate-low": "רוויה נמוכה",
  "highlight-links": "הדגשת קישורים",
  "larger-focus-rings": "פוקוס מוגדל",
  "big-cursor": "סמן גדול",
  "tooltips-on-hover": "חלוניות מידע",
  "reading-guide": "סרגל קריאה",
  "focus-mask": "מסכת קריאה",
  "pause-autoplay": "השהיית וידאו",
  "hide-images": "הסתרת תמונות",
};

const SR_LABEL_OPEN = "פתח תפריט נגישות";
const SR_LABEL_CLOSE = "סגור תפריט נגישות";
const SR_PANEL_LABEL = "תפריט נגישות";
const SR_RESET_LABEL = "איפוס הגדרות נגישות";
const SR_RESET_ANNOUNCEMENT = "כל הגדרות הנגישות אופסו";

const SECTIONS: ReadonlyArray<{
  title: string;
  controls: ReadonlyArray<A11yKey>;
}> = [
  // Phase A sections
  {
    title: "טקסט וקריאה",
    controls: ["text-l", "text-xl", "readable-font", "line-height-lg"],
  },
  {
    title: "צבע וניגודיות",
    controls: ["contrast-high", "contrast-dark"],
  },
  {
    title: "תנועה",
    controls: ["stop-motion"],
  },
  // Phase B sections — order chosen to match user mental model
  // ("filters" near "contrast", "links + focus" together, "cursor +
  // reading tools" together, "video + images" together).
  {
    title: "פילטרים ויזואליים",
    controls: ["invert", "grayscale", "saturate-high", "saturate-low"],
  },
  {
    title: "קישורים ופוקוס",
    controls: ["highlight-links", "larger-focus-rings"],
  },
  {
    title: "סמן וכלי קריאה",
    controls: ["big-cursor", "tooltips-on-hover", "reading-guide", "focus-mask"],
  },
  {
    title: "וידאו ותמונות",
    controls: ["pause-autoplay", "hide-images"],
  },
];

/**
 * Slice 52 Phase B — mutex groups enforced in `handleToggle` before the
 * cookie write. When the user activates a member of a mutex group, every
 * other member of the same group is silently disabled.
 *
 *   - FILTER_MUTEX: `filter:` rules collide visually (last applied wins);
 *     exposing both invert + grayscale would surprise the user. Keep one
 *     active at a time.
 *   - GUIDE_MUTEX:  reading-guide + focus-mask both track mouseY and
 *     overlap visually — only one makes sense.
 *
 * Phase A's `text-l` ↔ `text-xl` mutex is also enforced in `handleToggle`
 * but lives inline there for historical readability; the two patterns
 * are equivalent.
 */
const FILTER_MUTEX_KEYS: ReadonlyArray<A11yKey> = [
  "invert",
  "grayscale",
  "saturate-high",
  "saturate-low",
];
const GUIDE_MUTEX_KEYS: ReadonlyArray<A11yKey> = [
  "reading-guide",
  "focus-mask",
];

/** Selectors used by `tooltips-on-hover` to find elements that should
 *  show a custom tooltip. Anything with a `title` OR `aria-label` is
 *  fair game; the widget's own descendants are excluded via the closest
 *  `.a11yWidget` ancestor check in the handler. */
const TOOLTIP_TARGET_SELECTOR = "[title], [aria-label]";

/** Focus-mask geometry: a transparent slit of this height follows the
 *  cursor. ~120 px lines up with a comfortable two-line reading band. */
const FOCUS_MASK_SLIT_HEIGHT = 120;

/** Reading-guide overlay height, mirrors `.readingGuide { height: 40px }`
 *  in the CSS module. Kept in sync so the JS can centre it on the cursor. */
const READING_GUIDE_HEIGHT = 40;

// ── External-store glue ──────────────────────────────────────────────────
// `subscribe` listens for cross-tab cookie writes via the `storage` event.
// Cookies don't fire `storage`, but the same-tab writes are already pushed
// through `setPrefs`, so we just wire to `storage` as a no-cost no-op.

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getSnapshot(): string {
  // Returns the raw cookie string so `useSyncExternalStore`'s ref-equality
  // doesn't trigger a render on every read.
  return readPrefsCookieRaw();
}

function getServerSnapshot(): string {
  // SSR side has no cookie API here; the prefs are injected by the root
  // layout. The store snapshot only matters post-hydration on the client.
  return "";
}

// Tiny "is this running on the client?" store. Returning `false` on the
// server and `true` on the client gives us a hydration-safe flag without
// using `useEffect(() => setState(true), [])` — which React 19's
// `react-hooks/set-state-in-effect` rule flags as a cascading-render
// anti-pattern. The portal target (`document.body`) only exists on the
// client, so we gate the `createPortal` call on this flag.
function subscribeNoop(): () => void {
  return () => {};
}
function clientSnapshotTrue(): boolean {
  return true;
}
function serverSnapshotFalse(): boolean {
  return false;
}

// ─────────────────────────────────────────────────────────────────────────

export function A11yWidgetClient({
  initialPrefs,
}: {
  initialPrefs: A11yPrefs;
}) {
  // 1) Mount guard — `createPortal` requires a real `document`. Returns
  //    false on the server, true on the client (via `useSyncExternalStore`
  //    which is hydration-safe and doesn't trip React 19's
  //    `react-hooks/set-state-in-effect` rule).
  const mounted = useSyncExternalStore(
    subscribeNoop,
    clientSnapshotTrue,
    serverSnapshotFalse
  );

  // 2) Persisted prefs — `useSyncExternalStore` keeps React in step with
  //    whatever's actually in `document.cookie`. Cross-tab and same-tab
  //    consistency both go through this single source of truth.
  const cookieRaw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const cookieParsed = cookieRaw ? parseClassString(cookieRaw) : null;
  // Server snapshot is the "" empty string by design (see comment above);
  // fall back to the SSR-injected `initialPrefs` until the first client
  // read returns the actual cookie value. This guarantees the panel's
  // `aria-pressed` reflects what's on `<html>` from byte zero.
  const prefs: A11yPrefs = cookieParsed ?? initialPrefs;

  // 3) Panel state — open/closed lives in component state. ESC + outside-
  //    click + close-button + launcher-click all funnel through `setOpen`.
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Slice 52 Phase B overlay refs — used by the cursor-tracking + tooltip
  // effects below. The refs let the JS handlers update transform / style
  // directly (sidestepping a re-render for every mousemove tick).
  const readingGuideRef = useRef<HTMLDivElement | null>(null);
  const focusMaskTopRef = useRef<HTMLDivElement | null>(null);
  const focusMaskBottomRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 4) Live-region state — bumped by a counter so the same announcement
  //    text (e.g., toggle-on then toggle-off) re-announces on each change.
  const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });
  const announce = useCallback((text: string) => {
    setAnnouncement((prev) => ({ text, seq: prev.seq + 1 }));
  }, []);

  // 5) DOM application — every change to `prefs` must (a) update `<html>`
  //    classes so the global override CSS kicks in (or off), (b) write
  //    the cookie, and (c) if `stop-motion` just turned on, pause every
  //    HTML5 video on the page (per Gemini §Stop Animations).
  const applyPrefs = useCallback(
    (next: A11yPrefs, lastChangedKey?: A11yKey, lastChangedValue?: boolean) => {
      // (a) Update <html> + <body> classes. The override CSS module uses
      //     `html.lp-a11y-text-*` for typography and `body.lp-a11y-*` for
      //     contrast / font / line / motion — we mirror that split here
      //     so each class lands on the element the rule expects.
      const html = document.documentElement;
      const body = document.body;
      for (const key of A11Y_KEYS) {
        const cls = `${A11Y_HTML_CLASS_PREFIX}${key}`;
        const isTypographyOnHtml = key === "text-l" || key === "text-xl";
        const target = isTypographyOnHtml ? html : body;
        const other = isTypographyOnHtml ? body : html;
        // Clean up the wrong target in case of any drift.
        other.classList.remove(cls);
        if (next[key]) {
          target.classList.add(cls);
        } else {
          target.classList.remove(cls);
        }
      }

      // (b) Persist via cookie. Same-tab writers (this function) call
      //     `applyPrefs` first; cross-tab writers will route through
      //     `useSyncExternalStore` on next tick.
      writePrefsCookie(next);

      // (c) Side effects for specific controls.
      if (lastChangedKey === "stop-motion" && lastChangedValue === true) {
        document
          .querySelectorAll<HTMLVideoElement>("video")
          .forEach((v) => {
            try {
              v.pause();
            } catch {
              // No-op — the video might be in a state that disallows
              // sync pause (e.g., mid-decode); a future render will get it.
            }
          });
      }
    },
    []
  );

  // 6) Toggle / reset handlers.
  const handleToggle = useCallback(
    (key: A11yKey) => {
      const nextValue = !prefs[key];
      // Build a fully-mutable record from the readonly A11yPrefs (TS
      // refuses to mutate `prefs[K]` through the readonly type even via
      // spread). The `A11Y_KEYS` whitelist drives the construction so a
      // future Phase-C addition only requires updating the whitelist.
      const draft = Object.fromEntries(
        A11Y_KEYS.map((k) => [k, prefs[k]])
      ) as { [K in A11yKey]: boolean };
      draft[key] = nextValue;

      // Mutex 1 (Phase A): text-l ↔ text-xl.
      if (nextValue) {
        if (key === "text-l") draft["text-xl"] = false;
        if (key === "text-xl") draft["text-l"] = false;
      }

      // Mutex 2 (Phase B): filter group — invert / grayscale /
      // saturate-high / saturate-low. Enabling one silently disables
      // the others (visual rules collide; only one can win).
      if (nextValue && FILTER_MUTEX_KEYS.includes(key)) {
        for (const k of FILTER_MUTEX_KEYS) {
          if (k !== key) draft[k] = false;
        }
      }

      // Mutex 3 (Phase B): reading-guide ↔ focus-mask. Both track mouseY
      // and would overlap visually; only one can be active.
      if (nextValue && GUIDE_MUTEX_KEYS.includes(key)) {
        for (const k of GUIDE_MUTEX_KEYS) {
          if (k !== key) draft[k] = false;
        }
      }

      const next: A11yPrefs = draft;
      applyPrefs(next, key, nextValue);
      announce(
        nextValue
          ? `${HEBREW_LABEL[key]} הופעלה`
          : `${HEBREW_LABEL[key]} כובתה`
      );
    },
    [prefs, applyPrefs, announce]
  );

  const handleReset = useCallback(() => {
    const html = document.documentElement;
    const body = document.body;
    for (const key of A11Y_KEYS) {
      const cls = `${A11Y_HTML_CLASS_PREFIX}${key}`;
      html.classList.remove(cls);
      body.classList.remove(cls);
    }
    clearPrefsCookie();
    announce(SR_RESET_ANNOUNCEMENT);
  }, [announce]);

  // 7) ESC + outside-click closers + focus restore on close.
  const closePanel = useCallback(() => {
    setOpen(false);
    // Restore focus to the launcher so keyboard users don't get lost.
    requestAnimationFrame(() => {
      launcherRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    }
    function onClickOutside(e: MouseEvent) {
      const panel = panelRef.current;
      const launcher = launcherRef.current;
      if (!panel || !launcher) return;
      const target = e.target as Node;
      if (panel.contains(target) || launcher.contains(target)) return;
      closePanel();
    }
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, closePanel]);

  // 8) Focus trap inside the panel. Cycles forward + backward via Tab /
  //    Shift+Tab; loops at the ends. First focus on open lands on the
  //    close button (Gemini-spec: "the first interactive element within
  //    the open panel, often the Close button").
  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    function onTabKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      const list = Array.from(focusables).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onTabKey);
    return () => document.removeEventListener("keydown", onTabKey);
  }, [open]);

  // 9) When the panel opens, mark the page's main content as
  //    aria-hidden="true" so screen-reader virtual cursors don't drift
  //    out the back of the dialog. We restore the previous value (most
  //    pages have no attribute at all) on close.
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (open) {
      const prev = main.getAttribute("aria-hidden");
      main.setAttribute("aria-hidden", "true");
      return () => {
        if (prev === null) main.removeAttribute("aria-hidden");
        else main.setAttribute("aria-hidden", prev);
      };
    }
  }, [open]);

  // 10) When the cookie value changes externally (cross-tab), reflect it
  //     into the live DOM. The `useSyncExternalStore` value already keeps
  //     the panel UI in sync; we only need to mirror to <html>/<body> here.
  useEffect(() => {
    if (!cookieParsed) return;
    const html = document.documentElement;
    const body = document.body;
    for (const key of A11Y_KEYS) {
      const cls = `${A11Y_HTML_CLASS_PREFIX}${key}`;
      const isTypographyOnHtml = key === "text-l" || key === "text-xl";
      const target = isTypographyOnHtml ? html : body;
      const other = isTypographyOnHtml ? body : html;
      other.classList.remove(cls);
      if (cookieParsed[key]) target.classList.add(cls);
      else target.classList.remove(cls);
    }
  }, [cookieParsed]);

  // 11) Slice 52 Phase B — cursor-tracking overlays (reading-guide and
  //     focus-mask). A single mousemove listener positions whichever
  //     overlay is active; both overlays are mounted in the JSX below
  //     but `display: none`'d via inline style when their pref is off.
  //
  //     Touch-device guard: `matchMedia("(pointer: coarse)")` detects
  //     phones / tablets where mousemove is unreliable. On a coarse
  //     pointer the effect short-circuits and the CSS rule for these
  //     overlays at the end of the module hides them outright.
  //
  //     Throttling: requestAnimationFrame coalesces a burst of
  //     mousemove events down to one DOM update per paint, which keeps
  //     scroll perf clean even on a fast trackpad.
  const guideActive = prefs["reading-guide"];
  const maskActive = prefs["focus-mask"];
  useEffect(() => {
    if (!guideActive && !maskActive) return;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    let rafId: number | null = null;
    let pendingY: number | null = null;
    const update = () => {
      rafId = null;
      const y = pendingY;
      if (y === null) return;
      pendingY = null;
      if (guideActive && readingGuideRef.current) {
        const targetY = Math.max(0, y - READING_GUIDE_HEIGHT / 2);
        readingGuideRef.current.style.transform = `translateY(${targetY}px)`;
      }
      if (maskActive && focusMaskTopRef.current && focusMaskBottomRef.current) {
        const slitTop = Math.max(0, y - FOCUS_MASK_SLIT_HEIGHT / 2);
        const slitBottom = slitTop + FOCUS_MASK_SLIT_HEIGHT;
        focusMaskTopRef.current.style.height = `${slitTop}px`;
        focusMaskBottomRef.current.style.top = `${slitBottom}px`;
        focusMaskBottomRef.current.style.height = `${Math.max(
          0,
          window.innerHeight - slitBottom
        )}px`;
      }
    };
    const onMove = (e: MouseEvent) => {
      pendingY = e.clientY;
      if (rafId === null) rafId = requestAnimationFrame(update);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [guideActive, maskActive]);

  // 12) Slice 52 Phase B — tooltips-on-hover. Delegated focusin +
  //     mouseenter listeners on `document.body` show the custom
  //     tooltip element (`.tooltip` inside the widget portal) on any
  //     element with `title` or `aria-label`, EXCLUDING the widget
  //     itself (via a `closest(".a11yWidget")` guard).
  //
  //     Positioning: tooltip floats above the target by default; flips
  //     below if the target is too close to the viewport top.
  //     Hidden by setting `display: none` inline; revealed on each
  //     show via `display: block`.
  const tooltipsActive = prefs["tooltips-on-hover"];
  useEffect(() => {
    if (!tooltipsActive) return;

    const showFor = (el: Element) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.closest(".a11yWidget")) return;
      const label =
        el.getAttribute("aria-label") || el.getAttribute("title") || "";
      const text = label.trim();
      const tip = tooltipRef.current;
      if (!tip || !text) return;
      tip.textContent = text;
      tip.style.display = "block";
      // Measure then position. Default: above target with 8 px gap.
      // Flip below if the target sits in the top 80 px of the viewport.
      const rect = el.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const PAD = 8;
      const wantsBelow = rect.top < tipRect.height + PAD + 16;
      const top = wantsBelow
        ? rect.bottom + PAD
        : rect.top - tipRect.height - PAD;
      // Horizontally clamp to the viewport so a tooltip near the edge
      // doesn't render off-screen.
      const left = Math.max(
        8,
        Math.min(
          window.innerWidth - tipRect.width - 8,
          rect.left + rect.width / 2 - tipRect.width / 2
        )
      );
      tip.style.top = `${Math.max(8, top)}px`;
      tip.style.left = `${left}px`;
    };
    const hideTip = () => {
      const tip = tooltipRef.current;
      if (tip) tip.style.display = "none";
    };
    const onMouseEnter = (e: Event) => {
      const target = e.target as Element | null;
      if (!target) return;
      const labeled = target.closest?.(TOOLTIP_TARGET_SELECTOR);
      if (labeled) showFor(labeled);
    };
    const onMouseLeave = (e: Event) => {
      const target = e.target as Element | null;
      const next = (e as MouseEvent).relatedTarget as Element | null;
      if (
        target instanceof Element &&
        target.closest?.(TOOLTIP_TARGET_SELECTOR) &&
        (!next || !next.closest?.(TOOLTIP_TARGET_SELECTOR))
      ) {
        hideTip();
      }
    };
    const onFocusIn = (e: Event) => {
      const target = e.target as Element | null;
      const labeled = target?.closest?.(TOOLTIP_TARGET_SELECTOR);
      if (labeled) showFor(labeled);
    };
    const onFocusOut = () => hideTip();

    document.body.addEventListener("mouseenter", onMouseEnter, true);
    document.body.addEventListener("mouseleave", onMouseLeave, true);
    document.body.addEventListener("focusin", onFocusIn);
    document.body.addEventListener("focusout", onFocusOut);
    return () => {
      document.body.removeEventListener("mouseenter", onMouseEnter, true);
      document.body.removeEventListener("mouseleave", onMouseLeave, true);
      document.body.removeEventListener("focusin", onFocusIn);
      document.body.removeEventListener("focusout", onFocusOut);
      hideTip();
    };
  }, [tooltipsActive]);

  // 13) Slice 52 Phase B — pause-autoplay. On activate, pause every
  //     existing `<video>` once and attach a MutationObserver to keep
  //     pausing newly-inserted videos. Different from Phase A's
  //     `stop-motion` (which pauses once at toggle time only).
  const pauseAutoplayActive = prefs["pause-autoplay"];
  useEffect(() => {
    if (!pauseAutoplayActive) return;

    const safePause = (v: HTMLVideoElement) => {
      try {
        v.pause();
      } catch {
        // No-op — see stop-motion handler.
      }
    };
    document
      .querySelectorAll<HTMLVideoElement>("video")
      .forEach(safePause);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            safePause(node);
          } else if (node instanceof Element) {
            node
              .querySelectorAll?.<HTMLVideoElement>("video")
              .forEach(safePause);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pauseAutoplayActive]);

  if (!mounted) return null;

  const node = (
    <div className={`${styles.widgetRoot} a11yWidget`}>
      <button
        ref={launcherRef}
        type="button"
        className={styles.launcher}
        aria-label={open ? SR_LABEL_CLOSE : SR_LABEL_OPEN}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="lp-a11y-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <AccessibilityIcon />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="lp-a11y-panel"
          role="dialog"
          aria-modal="true"
          aria-label={SR_PANEL_LABEL}
          className={styles.panel}
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{SR_PANEL_LABEL}</h2>
            <button
              ref={closeBtnRef}
              type="button"
              className={styles.panelClose}
              onClick={closePanel}
              aria-label={SR_LABEL_CLOSE}
            >
              סגור
            </button>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              <div className={styles.grid}>
                {section.controls.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.toggle}
                    aria-pressed={prefs[key]}
                    onClick={() => handleToggle(key)}
                  >
                    {HEBREW_LABEL[key]}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            className={styles.reset}
            onClick={handleReset}
          >
            {SR_RESET_LABEL}
          </button>
        </div>
      ) : null}

      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
        // The key bump forces a "real" re-render on every announcement
        // even when the text repeats, so the SR re-speaks consistently.
        key={announcement.seq}
      >
        {announcement.text}
      </div>

      {/* Slice 52 Phase B — overlay elements. Mounted inside the widget
          portal (i.e. inside `.a11yWidget`) so the no-override
          `:not(.a11yWidget *)` exclusions keep them legible under every
          active control. JS effects above update the `style.transform`
          / `style.top` / `style.display` directly via refs. */}
      {prefs["reading-guide"] ? (
        <div
          ref={readingGuideRef}
          className={styles.readingGuide}
          aria-hidden="true"
        />
      ) : null}
      {prefs["focus-mask"] ? (
        <>
          <div
            ref={focusMaskTopRef}
            className={styles.focusMaskTop}
            aria-hidden="true"
            style={{ height: 0 }}
          />
          <div
            ref={focusMaskBottomRef}
            className={styles.focusMaskBottom}
            aria-hidden="true"
            style={{ top: 0, height: 0 }}
          />
        </>
      ) : null}
      {prefs["tooltips-on-hover"] ? (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          role="tooltip"
          aria-hidden="true"
          style={{ display: "none" }}
        />
      ) : null}
    </div>
  );

  return createPortal(node, document.body);
}

// ─────────────────────────────────────────────────────────────────────────
// Inline icon — universal person-in-circle accessibility glyph (Vitruvian-
// style outstretched-arms human figure, the W3C / IEC 80416-3 convention).
// 18×18 visual inside the 32×32 button (see `.launcher svg` in the CSS
// module, which is the authority on the rendered size); white stroke on
// navy-ink background = ~15.6:1 contrast (well above SC 1.4.11 3:1 floor
// for non-text contrast).

function AccessibilityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      {/* Head */}
      <circle cx="12" cy="4.5" r="1.6" fill="currentColor" />
      {/* Shoulders + arms (Vitruvian-style outstretched arms) */}
      <path
        d="M5 9 L19 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Torso */}
      <path
        d="M12 7 L12 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Legs (split into a triangular stance) */}
      <path
        d="M12 14 L8.5 21 M12 14 L15.5 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

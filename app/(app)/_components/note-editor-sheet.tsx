/**
 * Slice 25 B-1 — Per-question Notes editor (bottom sheet).
 *
 * Heavy component: lazy-loaded via `next/dynamic({ ssr: false })`
 * from `practice-question.tsx` so TipTap doesn't land in the
 * practice play screen's initial chunk. Mounted only while the sheet
 * is open.
 *
 * UX (matches the handoff):
 *   - Bottom sheet with a top drag handle, default ~55vh, draggable
 *     between 220px and 92vh. Backdrop click + Esc close.
 *   - Header carries an eyebrow + the question context label + an
 *     aria-live save status ("שומר…" / "נשמר אוטומטית").
 *   - Toolbar order (locked by the handoff): paragraph/H1/H2/H3 →
 *     B/I/U → bullet/ordered list → 4 colors → link → undo.
 *   - Editor: TipTap StarterKit + Underline + TextStyle + Color,
 *     RTL, Heebo. The link button is intentionally simple
 *     `prompt()`-based — polish is a separate slice.
 *
 * Auto-save:
 *   - Debounced 800ms after any content change.
 *   - Also flushed on close, so a fast-closer never loses input.
 *   - The action accepts both `content_json` (TipTap canonical) and
 *     `content_html` (sanitized cache for the bank).
 */

"use client";

import { Color } from "@tiptap/extension-color";
import { Link as TipTapLink } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { StarterKit } from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { saveNote } from "@/app/(app)/practice/play/_actions";
import { cn } from "@/lib/utils";

const AUTOSAVE_DEBOUNCE_MS = 800;
const SHEET_DEFAULT_VH = 55;
const SHEET_MIN_PX = 220;
const SHEET_MAX_VH = 92;

// Mapped from the handoff's 4 prototype colors to the live app
// palette: black → navy-ink, accent → primary navy, gold → gold,
// danger → red-700. TipTap's Color extension takes hex strings;
// CSS vars don't resolve inside it, so the constants are inlined.
const EDITOR_COLORS = [
  { hex: "#0F1F4F", label: "שחור" },
  { hex: "#1E3A8A", label: "נייבי" },
  { hex: "#C9A149", label: "זהב" },
  { hex: "#B91C1C", label: "אדום" },
];

type InitialNote = {
  contentJson: unknown;
  contentHtml: string;
  updatedAt: string;
};

export type NoteEditorSheetProps = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  position: number;
  questionContextLabel: string;
  initialNote: InitialNote | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteEditorSheet({
  open,
  onClose,
  sessionId,
  position,
  questionContextLabel,
  initialNote,
}: NoteEditorSheetProps) {
  // Drag-resize: default null lets the CSS class drive the initial
  // height (SSR-safe). User drag switches us to a controlled px
  // value via window.innerHeight (only invoked client-side after
  // first interaction).
  const [sheetHeightPx, setSheetHeightPx] = useState<number | null>(null);

  // Save state machine. `dirty` tracks whether the buffered content
  // diverges from the last successfully-saved snapshot, so the
  // close-flush only fires when there's something to persist.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const dirtyRef = useRef(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>(
    JSON.stringify(initialNote?.contentJson ?? null)
  );

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already ships Heading, BulletList, OrderedList,
      // ListItem — the Slice 25 B-1 commands were correct; Slice 25
      // B-1.1 scopes display CSS so they render visually too.
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TipTapLink.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Placeholder.configure({
        placeholder:
          "כתוב כאן הערה אישית לשאלה הזו — רק אתה רואה אותה.",
      }),
    ],
    content: (initialNote?.contentJson as object | undefined) ?? "",
    editorProps: {
      attributes: {
        dir: "rtl",
        // Slice 25 B-1.1 — `note-editor-content` is the scoped class
        // defined in app/globals.css that restores list bullets +
        // heading sizes the Tailwind preflight reset away. The prior
        // `prose prose-sm` markers were no-ops (the typography plugin
        // isn't installed in this project).
        class:
          "note-editor-content font-heebo max-w-none focus:outline-none min-h-[160px] text-[15px] leading-relaxed",
      },
    },
    // Slice 25 B-1 — SSR safety. Without this option, useEditor
    // would call ProseMirror APIs during render on the server.
    // Although the component is `next/dynamic({ ssr:false })`'d, the
    // option still flips ProseMirror into a client-only-ready mode.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      dirtyRef.current = true;
      scheduleAutoSave(editor);
    },
  });

  function scheduleAutoSave(ed: Editor): void {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      void flushSave(ed);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function flushSave(ed: Editor): Promise<void> {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    const jsonDoc = ed.getJSON();
    const jsonString = JSON.stringify(jsonDoc);
    if (jsonString === lastSavedJsonRef.current) {
      dirtyRef.current = false;
      return;
    }
    const html = ed.getHTML();
    setSaveStatus("saving");
    const result = await saveNote({
      sessionId,
      position,
      contentJson: jsonDoc,
      contentHtml: html,
    });
    if (result.ok) {
      lastSavedJsonRef.current = jsonString;
      dirtyRef.current = false;
      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
      toast.error(result.error);
    }
  }

  // Esc-to-close + backdrop click already handle dismissal; we also
  // flush the in-flight save on close so a fast-closer doesn't drop
  // input.
  function handleClose(): void {
    if (editor) void flushSave(editor);
    onClose();
  }

  // Esc keyboard close. Attaches/detaches in sync with `open`.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup any pending debounce when the component unmounts.
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  // Drag-resize implementation. We touch `window.innerHeight` only
  // inside the drag callbacks, never during initial render — so SSR
  // safety is preserved and the `next/dynamic({ ssr:false })` import
  // gives us a complete client guarantee on top.
  function startDrag(e: React.MouseEvent | React.TouchEvent): void {
    e.preventDefault();
    const startY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const startHeight =
      sheetHeightPx ?? Math.round(window.innerHeight * (SHEET_DEFAULT_VH / 100));
    const maxPx = Math.round(window.innerHeight * (SHEET_MAX_VH / 100));

    function clamp(next: number): number {
      return Math.max(SHEET_MIN_PX, Math.min(maxPx, next));
    }

    function onMove(ev: MouseEvent | TouchEvent): void {
      const y =
        "touches" in ev
          ? (ev as TouchEvent).touches[0].clientY
          : (ev as MouseEvent).clientY;
      setSheetHeightPx(clamp(startHeight + (startY - y)));
    }
    function onUp(): void {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-150"
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="עורך הערות"
        dir="rtl"
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl",
          "bg-background shadow-[0_-16px_48px_rgba(15,31,79,0.18)]",
          // CSS-driven default height kicks in when the user hasn't
          // dragged yet. Once they drag, the inline style takes over.
          sheetHeightPx === null && "h-[55vh] max-h-[92vh] min-h-[220px]"
        )}
        style={
          sheetHeightPx !== null ? { height: sheetHeightPx } : undefined
        }
      >
        {/* Drag handle */}
        <div
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          className="flex shrink-0 cursor-ns-resize select-none items-center justify-center py-2.5 touch-none"
          title="גרור לשינוי גובה"
        >
          <div className="h-1.5 w-11 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 pb-3.5 pt-1">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              הערה אישית
            </div>
            <div
              dir="auto"
              className="mt-0.5 truncate font-heebo text-[17px] font-semibold text-foreground"
            >
              {questionContextLabel}
            </div>
          </div>
          <SaveStatusBadge status={saveStatus} />
          <button
            type="button"
            onClick={handleClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Toolbar */}
        <Toolbar editor={editor} />

        {/* Editor surface */}
        <div className="flex-1 overflow-auto px-7 py-5">
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-3">
          <div className="font-heebo text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10.5px]">
              Esc
            </kbd>{" "}
            לסגירה
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            סיים
          </button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Save status badge — aria-live polite, switches between idle states
// =============================================================================

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  // Slice 25 B-1.1 — distinguish "idle / never edited yet" from
  // "just-saved". Idle reads "נשמר אוטומטית" (the standing promise);
  // the post-save state pops "נשמר ✓" so the user gets a brief
  // confirmation right after each successful flush.
  const label =
    status === "saving"
      ? "שומר…"
      : status === "saved"
        ? "נשמר ✓"
        : status === "error"
          ? "שגיאת שמירה"
          : "נשמר אוטומטית";
  const tone =
    status === "error"
      ? "text-destructive"
      : status === "saving"
        ? "text-amber-700"
        : status === "saved"
          ? "text-[var(--color-status-strong)]"
          : "text-muted-foreground";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("font-heebo text-xs", tone)}
    >
      {label}
    </span>
  );
}

// =============================================================================
// Toolbar
// =============================================================================

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    // Skeleton row keeps the layout stable during the brief moment
    // the editor instance is being created.
    return (
      <div className="h-12 shrink-0 border-b border-border bg-card" aria-hidden />
    );
  }
  // Narrow the type for the closures below — TS doesn't propagate
  // the null guard through nested function expressions.
  const ed: Editor = editor;

  function exec(fn: (chain: ReturnType<Editor["chain"]>) => void): void {
    fn(ed.chain().focus());
  }

  function handleParagraphChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    if (value === "p") exec((c) => void c.setParagraph().run());
    else if (value === "h1") exec((c) => void c.toggleHeading({ level: 1 }).run());
    else if (value === "h2") exec((c) => void c.toggleHeading({ level: 2 }).run());
    else if (value === "h3") exec((c) => void c.toggleHeading({ level: 3 }).run());
  }

  function handleLink(): void {
    const previous = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("קישור:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      exec((c) => void c.unsetLink().run());
      return;
    }
    exec((c) => void c.setLink({ href: url }).run());
  }

  const paragraphValue = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card px-4 py-2.5">
      <select
        value={paragraphValue}
        onChange={handleParagraphChange}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <option value="p">טקסט רגיל</option>
        <option value="h1">כותרת 1</option>
        <option value="h2">כותרת 2</option>
        <option value="h3">כותרת 3</option>
      </select>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => exec((c) => void c.toggleBold().run())}
        title="מודגש"
      >
        <span className="text-sm font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => exec((c) => void c.toggleItalic().run())}
        title="נטוי"
      >
        <span className="text-sm italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => exec((c) => void c.toggleUnderline().run())}
        title="קו תחתון"
      >
        <span className="text-sm underline">U</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => exec((c) => void c.toggleBulletList().run())}
        title="רשימה לא ממוספרת"
      >
        <BulletListIcon />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => exec((c) => void c.toggleOrderedList().run())}
        title="רשימה ממוספרת"
      >
        <OrderedListIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <div className="flex items-center gap-1">
        {EDITOR_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => exec((chain) => void chain.setColor(c.hex).run())}
            title={c.label}
            aria-label={`צבע ${c.label}`}
            className="h-5 w-5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            style={{ background: c.hex }}
          />
        ))}
      </div>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive("link")}
        onClick={handleLink}
        title="קישור"
      >
        <LinkIcon />
      </ToolbarButton>

      <div className="ms-auto">
        <ToolbarButton
          onClick={() => exec((c) => void c.undo().run())}
          title="ביטול"
          active={false}
        >
          <Undo2 className="size-4" aria-hidden />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        "hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active && "bg-[var(--color-gold-tint)] text-[var(--color-gold-deep)]"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function BulletListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
      <path d="M10 6h10M10 12h10M10 18h10" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <text x="2" y="9" fontSize="7" fill="currentColor" fontFamily="monospace">
        1
      </text>
      <text
        x="2"
        y="15"
        fontSize="7"
        fill="currentColor"
        fontFamily="monospace"
      >
        2
      </text>
      <text
        x="2"
        y="21"
        fontSize="7"
        fill="currentColor"
        fontFamily="monospace"
      >
        3
      </text>
      <path d="M10 6h10M10 12h10M10 18h10" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}

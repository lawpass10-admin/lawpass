"use client";

/**
 * "הוסף תשובה בכתב ידך" — attach a photographed answer to a writing task.
 *
 * The bar exam is written by hand, so a student rehearsing it writes on paper.
 * This is where the paper gets in: up to two photos, one per A4 side, which is
 * the same two-page limit the typed answer box is sized to.
 *
 * ── What happens when ──────────────────────────────────────────────────────
 * Choosing a file does NOT upload it. The photo is previewed from a local
 * object URL and can be removed; only "שמור" sends it. That is deliberate: a
 * student photographing two pages on a phone will retake at least one of them,
 * and uploading each attempt would put a wait between them and the retake.
 *
 * Pages saved on an earlier visit come back as `uploaded` slots and are not
 * re-sent — reopening the dialog to see what is attached costs nothing.
 *
 * Removing a page that was already uploaded drops the reference, not the asset:
 * the photo stays in Cloudinary, unreferenced, until something sweeps it. The
 * alternative — deleting on remove — is a delete call that can fail mid-edit,
 * and an asset gone for good if the student changes their mind.
 *
 * The body is a separate component mounted only while the dialog is open, so
 * each opening starts from whatever is attached NOW, with no effect syncing
 * props into state and no chance of a stale preview surviving a close.
 */

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  uploadHandwriting,
  type HandwritingPage,
} from "@/lib/api/open-questions";

/** One A4 side per photo, and an answer is two sides. */
const MAX_PAGES = 2;
/** Matches the server's per-file cap; checked here so the wait is not wasted. */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/**
 * A page in the dialog is either already stored (has a Cloudinary reference) or
 * still a file on this machine (has a preview URL that has to be revoked).
 */
type Slot =
  | { kind: "uploaded"; page: HandwritingPage }
  | { kind: "local"; file: File; previewUrl: string };

type Props = {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pages already attached to the answer being written. */
  pages: HandwritingPage[];
  /** Called with the new set once "שמור" succeeds. */
  onPagesChange: (pages: HandwritingPage[]) => void;
};

export function HandwritingDialog({ open, onOpenChange, ...rest }: Props) {
  // Lifted out of the body so a close cannot land mid-upload: the body unmounts
  // on close, and unmounting while the request is in flight would lose the
  // references to photos that did reach Cloudinary.
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={!saving}>
        {open ? (
          <HandwritingDialogBody
            {...rest}
            saving={saving}
            setSaving={setSaving}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HandwritingDialogBody({
  questionId,
  pages,
  onPagesChange,
  onOpenChange,
  saving,
  setSaving,
}: Omit<Props, "open"> & {
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    pages.map((page) => ({ kind: "uploaded", page }))
  );
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Every preview URL ever created here, revoked when the dialog closes. They
  // are cheap but not free — each one pins a whole photo in memory. Tracked in
  // a ref rather than derived from `slots`, because a cleanup keyed on `slots`
  // would revoke the previews still on screen every time one is added.
  const createdUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = createdUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const room = MAX_PAGES - slots.length;
    if (room <= 0) {
      setError(`אפשר לצרף עד ${MAX_PAGES} עמודים`);
      return;
    }

    const accepted: Slot[] = [];
    let rejection = "";
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        rejection = "אפשר לצרף תמונות בלבד (JPG, PNG, WebP או HEIC)";
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejection = `"${file.name}" גדול מדי (מקסימום 10MB לעמוד)`;
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      createdUrls.current.push(previewUrl);
      accepted.push({ kind: "local", file, previewUrl });
    }

    if (accepted.length > 0) setSlots((prev) => [...prev, ...accepted]);
    setError(
      rejection || (files.length > room ? `אפשר לצרף עד ${MAX_PAGES} עמודים` : "")
    );
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
    setError("");
    // The URL itself is left for the unmount cleanup: revoking it here would
    // break the preview if the same slot is somehow still rendering.
  }

  async function handleSave() {
    if (saving) return;
    setError("");

    const localFiles = slots
      .filter((s): s is Extract<Slot, { kind: "local" }> => s.kind === "local")
      .map((s) => s.file);

    // Nothing new chosen — this is a removal, or no change at all. No upload
    // needed, just the shorter list.
    if (localFiles.length === 0) {
      onPagesChange(
        slots.flatMap((s) => (s.kind === "uploaded" ? [s.page] : []))
      );
      onOpenChange(false);
      return;
    }

    setSaving(true);
    const result = await uploadHandwriting(questionId, localFiles);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // The new references go back where their local slots were, so the order on
    // screen is the order that gets stored: the page shown first is page 1.
    const fresh = [...result.data];
    const merged = slots.flatMap((slot) => {
      if (slot.kind === "uploaded") return [slot.page];
      const next = fresh.shift();
      return next ? [next] : [];
    });

    setSaving(false);
    onPagesChange(merged.map((page, i) => ({ ...page, page: i + 1 })));
    onOpenChange(false);
  }

  const full = slots.length >= MAX_PAGES;
  const changed =
    slots.some((s) => s.kind === "local") || slots.length !== pages.length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>תשובה בכתב ידך</DialogTitle>
        <DialogDescription>
          צלם כל עמוד לחוד, ישר ובאור טוב — עד שני עמודים, כמו במבחן עצמו.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {slots.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center"
            style={{
              borderColor: "var(--color-border, rgba(0,0,0,0.18))",
              color: "var(--color-ink-dim)",
            }}
          >
            <ImagePlus className="size-6" aria-hidden />
            <p className="font-heebo" style={{ fontSize: 13 }}>
              עוד לא צורפו תמונות
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {slots.map((slot, i) => (
              <li
                key={slot.kind === "uploaded" ? slot.page.public_id : slot.previewUrl}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--color-border, rgba(0,0,0,0.15))" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.kind === "local" ? slot.previewUrl : slot.page.url}
                  alt={`עמוד ${i + 1}`}
                  className="size-16 rounded-md object-cover"
                  style={{ background: "var(--color-paper-2, rgba(0,0,0,0.04))" }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="font-heebo font-bold"
                    style={{ fontSize: 14, color: "var(--color-navy-ink)" }}
                  >
                    {`עמוד ${i + 1}`}
                  </p>
                  <p
                    className="truncate font-heebo"
                    style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
                  >
                    {slot.kind === "local"
                      ? `${slot.file.name} · ${formatSize(slot.file.size)}`
                      : "נשמר"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeSlot(i)}
                  disabled={saving}
                  aria-label={`הסר עמוד ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            // Reset, or choosing the SAME file again fires no change event and
            // a retaken photo with the same name silently does nothing.
            e.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={full || saving}
          className="h-11 w-full md:h-10"
        >
          <ImagePlus className="size-4" aria-hidden />
          {full ? "צורפו שני עמודים" : "בחר תמונה"}
        </Button>

        {error ? (
          <p
            role="alert"
            className="font-heebo"
            style={{ fontSize: 13, color: "var(--color-danger, #b42318)" }}
          >
            {error}
          </p>
        ) : null}

        {/* The one thing a student must not misread: the photos are kept, not
            marked. Bold and above the small print, because someone who answers
            only on paper would otherwise wait for a grade that never comes. */}
        <p
          className="font-heebo font-bold"
          style={{ fontSize: 13, color: "var(--color-navy-ink)" }}
        >
          העלאת התמונות היא רק לצורך שמירתן. בדיקת השאלה מתבצעת רק לגבי התשובה
          המוקלדת למערכת.
        </p>

        <p
          className="font-heebo"
          style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
        >
          &quot;שמור&quot; מעלה את התמונות ומצרף אותן לתשובה — הן נשמרות לתשובה עצמה
          רק כששולחים אותה לבדיקה. עד 10MB לעמוד. צירוף תמונות הוא רשות.
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={saving}
          className="h-11 md:h-10"
        >
          ביטול
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !changed}
          className="h-11 md:h-10"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              מעלה…
            </>
          ) : (
            <>
              <Upload className="size-4" aria-hidden />
              שמור
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

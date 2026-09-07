/**
 * The Hebrew RTL shell every LawPass email is rendered into.
 *
 * ── Why the markup looks like 2005 ─────────────────────────────────────────
 * Tables, inline styles, no flexbox, no CSS variables. Email clients are not
 * browsers: Outlook renders with Word's engine, Gmail strips <style> blocks in
 * some views and rewrites classes, and nothing supports `var(--x)`. The site's
 * tokens are therefore inlined as literal hex below and kept in sync by hand —
 * globals.css is the source of truth, this is a copy, and that is the trade
 * email markup forces on you.
 *
 * ── RTL ────────────────────────────────────────────────────────────────────
 * `dir="rtl"` on <html> is not enough on its own: several clients drop
 * attributes on the root element, so direction is repeated as an inline style
 * on the wrapper table and on each text cell. Belt and braces, because a
 * Hebrew email that renders left-aligned reads as broken.
 */

/** globals.css, inlined. Keep in step with the tokens named in the comments. */
const NAVY = "#1E3A8A"; // --color-navy
const NAVY_INK = "#0F1F4F"; // --color-navy-ink
const INK_DIM = "#535A6E"; // --color-ink-dim
const INK_MUTED = "#8A8F9F"; // --color-ink-muted
const LINE = "#E8E5DC"; // --color-line
const PAGE_BG = "#F4F5F7";
const CARD_BG = "#FFFFFF";

/**
 * Hebrew-capable stack. Heebo is the site's face and is named first for the
 * handful of clients that resolve webfonts, but the fallbacks are what will
 * actually render: Arial and Tahoma both carry full Hebrew coverage on Windows
 * and macOS, which a bare `sans-serif` does not guarantee.
 */
const FONT = "'Heebo', Arial, 'Segoe UI', Tahoma, sans-serif";

/**
 * Escapes text before it goes into the HTML body.
 *
 * MUST be used on anything that came from a user or the database — a
 * candidate's name, a question title. Webmail renders our HTML, so an
 * unescaped apostrophe is a broken email and an unescaped tag is worse.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  /** Subject-line-equivalent shown at the top of the message body. */
  heading: string;
  /**
   * The inbox preview line, shown next to the subject before opening.
   *
   * Left unset, clients grab the first words of the body — which for a LawPass
   * email is the greeting, so every message previews as "שלום". Worth setting.
   */
  preheader?: string;
  /** Paragraphs of body text. Escaped for you — pass plain strings. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the rule. Escaped. */
  footerNote?: string;
  /**
   * One-click opt-out, rendered as a link in the footer.
   *
   * Required on lifecycle mail — anything the candidate did not directly ask
   * for. Israeli law (חוק התקשורת, תיקון 40) wants a working opt-out on
   * commercial messages, and Gmail weighs its presence when deciding between
   * the inbox and the spam folder. Omit it only for genuinely transactional
   * mail (password reset, email verification), which nobody should be able to
   * unsubscribe from.
   */
  unsubscribeUrl?: string;
};

/**
 * Wraps content in the shell and returns a complete HTML document.
 *
 * Text is escaped here rather than at the call site, so a caller cannot forget.
 * A template that genuinely needs markup should compose its own <p> and pass
 * it through `paragraphs` pre-escaped — there is deliberately no raw-HTML
 * escape hatch, because that is where injection bugs come from.
 */
export function renderEmail(content: EmailContent): string {
  const { heading, preheader, paragraphs, cta, footerNote, unsubscribeUrl } = content;

  const paragraphHtml = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK_DIM};` +
        `direction:rtl;text-align:right;">${escapeHtml(text)}</p>`
    )
    .join("\n");

  // A "bulletproof button": a table cell with a background, not a styled <a>.
  // Outlook ignores padding and background on inline anchors.
  const ctaHtml = cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
        <tr>
          <td align="center" bgcolor="${NAVY}" style="border-radius:8px;">
            <a href="${escapeHtml(cta.url)}"
               style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;
                      font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">
              ${escapeHtml(cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  // Hidden from the rendered body, read by the inbox list. The trailing
  // zero-width characters stop clients padding the preview with body text.
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
         ${escapeHtml(preheader)}${"&#8204;&nbsp;".repeat(60)}
       </div>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};direction:rtl;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${PAGE_BG};padding:24px 12px;direction:rtl;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:${CARD_BG};border:1px solid ${LINE};
                    border-radius:12px;direction:rtl;font-family:${FONT};">
        <tr>
          <td style="padding:28px 28px 8px;direction:rtl;text-align:right;">
            <div style="font-size:13px;font-weight:bold;color:${NAVY};letter-spacing:0.5px;">LawPass</div>
            <h1 style="margin:8px 0 18px;font-size:21px;line-height:1.4;color:${NAVY_INK};font-weight:bold;">
              ${escapeHtml(heading)}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 8px;direction:rtl;text-align:right;">
${paragraphHtml}
${ctaHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;direction:rtl;text-align:right;">
            <hr style="border:none;border-top:1px solid ${LINE};margin:0 0 12px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${INK_MUTED};">
              ${footerNote ? escapeHtml(footerNote) + "<br>" : ""}
              הודעה זו נשלחה על ידי LawPass — הכנה לבחינת לשכת עורכי הדין.
              ${
                unsubscribeUrl
                  ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:${INK_MUTED};text-decoration:underline;">` +
                    `הסרה מרשימת התפוצה</a>`
                  : ""
              }
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

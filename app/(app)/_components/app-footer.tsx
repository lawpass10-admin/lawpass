/**
 * The copyright line, on every signed-in page.
 *
 * Rendered from <AppShell> on BOTH branches — the sidebar one and the focus
 * one — so it is on the exam and the two workspaces as well, not only the
 * pages with chrome. The (auth) group is a different layout and does not get
 * it: a login form is not a page of ours to mark.
 *
 * `mt-auto` rather than a fixed position. The shell is a flex column, so this
 * sits under the content on a short page and after it on a long one, and it
 * never covers anything — which a fixed footer would do on the fixed-height
 * exam screens, where every pixel of the column is already spoken for.
 *
 * `print:hidden` because a candidate printing a question sheet does not want a
 * site footer on the page, and `select-none` because it is chrome rather than
 * content — the app-wide deterrent already blocks it, and this keeps it out of
 * a selection someone drags across the page.
 */
export function AppFooter() {
  return (
    <footer
      className="mt-auto w-full select-none px-4 py-5 text-center print:hidden"
      // Not a <nav> or a landmark: it carries no links and no interaction, so
      // contentinfo would announce a region with nothing in it to navigate to.
    >
      <p
        className="font-heebo"
        style={{ fontSize: 12.5, color: "var(--color-ink-dim)" }}
      >
        © LawPass 2026 כל הזכויות שמורות
      </p>
    </footer>
  );
}

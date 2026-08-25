"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Holds the page while something must not be interrupted.
 *
 * Leaving a page mid-operation has three separate exits, and blocking one
 * without the others just moves the accident:
 *
 *   1. an in-app link (the sidebar, a breadcrumb, a button rendered as <Link>)
 *      — caught by a capture-phase click listener, which runs BEFORE the
 *      router's own handler, so the navigation never starts;
 *   2. closing the tab, reloading, or typing a new address — `beforeunload`,
 *      which can only raise the browser's own generic dialog. The wording is
 *      the browser's and cannot be set; that is the platform, not an oversight;
 *   3. the browser Back button — a sentinel history entry pushed while the
 *      guard is armed absorbs the first Back, and the popstate handler puts it
 *      straight back so the page stays put while the question is asked.
 *
 * Exits 1 and 3 route through a Hebrew dialog rather than window.confirm, so
 * the block reads as part of the app and can explain itself. Nothing here
 * traps the user: every path offers "צא בכל זאת", it just cannot happen by a
 * stray click.
 *
 * `active` is expected to flip to false on its own (the operation finishes),
 * at which point every listener and the sentinel entry are removed.
 */
export function NavigationGuard({
  active,
  title,
  description,
  stayLabel = "הישאר בדף",
  leaveLabel = "צא בכל זאת",
}: {
  active: boolean;
  title: string;
  description: string;
  stayLabel?: string;
  leaveLabel?: string;
}) {
  const router = useRouter();
  // The exit the user asked for and has not confirmed yet: a URL from a link,
  // or "back" from the Back button. Null means no question is on screen.
  const [pending, setPending] = useState<string | "back" | null>(null);
  // Set the moment we hand control back to the browser, so the popstate the
  // programmatic back() fires is not mistaken for the user pressing Back again.
  const leaving = useRef(false);

  useEffect(() => {
    if (!active) return;
    leaving.current = false;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // preventDefault is the modern spelling, returnValue the one older
      // browsers still need. Neither lets us choose the wording.
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      // Anything that was never going to navigate this tab is left alone:
      // already-handled clicks, middle/right buttons, and the modifier combos
      // that mean "open in a new tab/window" or "download".
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.href;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // An off-site link unloads the document, so beforeunload already asks —
      // catching it here too would ask twice. Same-page anchors and query-only
      // changes are not leaving at all.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };

    const onPopState = () => {
      if (leaving.current) return;
      // Undo the Back immediately: the page must not be half-gone while the
      // dialog waits for an answer.
      window.history.pushState(null, "", window.location.href);
      setPending("back");
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase — the router's own listener is on the bubble phase, so
    // stopPropagation here is what keeps the navigation from starting.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    // The sentinel: one extra entry pointing at this same URL, so the first
    // Back lands on the page it started from. Marked so the cleanup can tell
    // whether it is still the entry the user is standing on.
    window.history.pushState({ navGuard: true }, "", window.location.href);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);

      // Take the sentinel back out when the guard disarms in place — the
      // usual ending, where the operation simply finished. Left behind, it
      // would cost the user a Back press that appears to do nothing (it
      // navigates from this URL to the same URL). Only safe while it is still
      // the current entry: once the user has navigated on, it is buried in
      // the stack and going back would take them somewhere they did not ask
      // for.
      const state = window.history.state as { navGuard?: boolean } | null;
      if (state?.navGuard) window.history.back();
    };
  }, [active]);

  const leave = useCallback(() => {
    const target = pending;
    setPending(null);
    if (!target) return;
    leaving.current = true;
    // Two hops back: the sentinel entry, then the page the user actually came
    // from. router.back() would only undo the sentinel and look like nothing
    // happened.
    if (target === "back") window.history.go(-2);
    else router.push(target);
  }, [pending, router]);

  if (!active) return null;

  return (
    <Dialog open={pending !== null} onOpenChange={(next) => {
      if (!next) setPending(null);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={leave}>
            {leaveLabel}
          </Button>
          <Button type="button" onClick={() => setPending(null)}>
            {stayLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

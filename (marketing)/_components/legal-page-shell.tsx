import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";

import type {
  LegalBlock,
  LegalPageCopy,
} from "@/app/(marketing)/_components/legal-copy";

import styles from "./landing.module.css";

/**
 * Slice 50 — shared chrome for `/privacy` and `/accessibility`.
 *
 * Server Component. Renders:
 *   - A minimal top strip: LawPass logo (→ "/") on one side, "← חזרה לדף
 *     הנחיתה" (→ "/") on the other. Both are reachable to keyboard +
 *     screen-reader users — the strip stays small + sticky-free so it
 *     doesn't compete with the document body.
 *   - The document body — a typed list of `LegalBlock`s from the copy
 *     module, mapped to semantic HTML (`<h1>` / muted subtitle / `<h2>` /
 *     `<h3>` / `<p>` / `<ul><li>`). Consecutive `li` blocks are grouped
 *     into a single `<ul>` so each top-level list renders as one logical
 *     unit.
 *
 * Both legal pages sit inside the `(marketing)` group, so the marketing
 * `layout.tsx` applies its overflow-clip + the design tokens via
 * `<div className={styles.landingRoot}>`. We wrap the document body in
 * `.legalPage` to scope the prose typography (line-height 1.7, ~70ch
 * max-width, h2/h3 rhythm, ul bullets) without leaking into anything else.
 */

function renderBlocks(blocks: readonly LegalBlock[]) {
  // Group consecutive `li` blocks into a single <ul> while preserving the
  // surrounding block order. The result is a flat array of React nodes ready
  // for direct mounting.
  const nodes: React.ReactNode[] = [];
  let liBuffer: { idx: number; text: string }[] = [];
  let liGroupId = 0;

  const flushLi = () => {
    if (!liBuffer.length) return;
    liGroupId += 1;
    nodes.push(
      <ul key={`ul-${liGroupId}`}>
        {liBuffer.map((item) => (
          <li key={`${liGroupId}-${item.idx}`}>{item.text}</li>
        ))}
      </ul>
    );
    liBuffer = [];
  };

  blocks.forEach((block, idx) => {
    if (block.kind === "li") {
      liBuffer.push({ idx, text: block.text });
      return;
    }
    flushLi();
    switch (block.kind) {
      case "h1":
        nodes.push(<h1 key={idx}>{block.text}</h1>);
        break;
      case "subtitle":
        nodes.push(
          <p key={idx} className={styles.legalSubtitle}>
            {block.text}
          </p>
        );
        break;
      case "h2":
        nodes.push(<h2 key={idx}>{block.text}</h2>);
        break;
      case "h3":
        nodes.push(<h3 key={idx}>{block.text}</h3>);
        break;
      case "p":
        nodes.push(<p key={idx}>{block.text}</p>);
        break;
    }
  });
  flushLi();
  return nodes.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}

export function LegalPageShell({ copy }: { copy: LegalPageCopy }) {
  return (
    <div className={styles.legalRoot}>
      <header className={styles.legalTopstrip}>
        <div className={styles.legalTopstripInner}>
          <Link
            aria-label="LawPass"
            className={styles.legalLogoLink}
            href="/"
          >
            <Image
              alt="LawPass"
              src="/landing/lawpass-logo-landing.png"
              width={195}
              height={113}
              priority
            />
          </Link>
          <Link className={styles.legalBackLink} href="/">
            <span aria-hidden>←</span> חזרה לדף הנחיתה
          </Link>
        </div>
      </header>

      <main className={styles.legalPage} id="main-content" tabIndex={-1}>
        <article className={styles.legalProse}>
          {renderBlocks(copy.blocks)}
        </article>
      </main>
    </div>
  );
}

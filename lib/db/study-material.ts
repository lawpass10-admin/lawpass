/**
 * The study material a candidate reads — LawPass's own text, never the source.
 *
 * Reads `public.study_material_public` (migration 20260928000002), NOT the
 * `study_material` table behind it. That table carries two texts on one row:
 * the extracted source, which is someone else's copyrighted expression, and the
 * version LawPass authored under scripts/ingestion/LLM-text-converting.json.
 * RLS can restrict rows but not columns, so the table is admin-only and the
 * view is the safe subset — the source column is simply not in it.
 *
 * That is also why this runs on the caller's own Supabase client rather than
 * the service role: the view is granted to `authenticated`, so a candidate's
 * session reads it directly and no elevated key is anywhere near the request.
 *
 * Rows whose conversion has not run yet are excluded by the view, so anything
 * returned here is safe to render as-is.
 */

import type { createClient } from "@/lib/supabase/server";

/** One item: a form to avoid, the one to prefer, and why. */
export type StudyItem = {
  id: string;
  avoid: string;
  use: string;
  reason: string;
  example: string;
  exam_note: string;
};

/** Items sharing a cause — the axis LawPass organises by. */
export type StudyGroup = {
  id: string;
  heading: string;
  why_this_group: string;
  items: StudyItem[];
};

/** One section of a plain document: a heading and what sits under it. */
export type StudySection = {
  id: string;
  heading: string;
  paragraphs: string[];
  tables: { columns: string[] | null; rows: (string[] | Record<string, string>)[] }[];
};

/**
 * TWO KINDS OF DOCUMENT, and the reason they are a union rather than one shape
 * with optional halves.
 *
 * `guide` is what rewrite-source.mjs produces: usage items grouped by the cause
 * of the error. Its unit is a pair, and it is read as a table.
 *
 * `sections` is a document that was not converted into that form because it has
 * no unprotectable layer to convert — a booklet of worked examples, stored
 * verbatim under a publication hold (migration 20260930000001). Its unit is a
 * passage, and it is read as prose.
 *
 * Making it a union means every screen has to say which it is handling. The
 * alternative — one type with `groups?` and `sections?` — compiles happily
 * while rendering nothing, which is exactly how the third booklet was invisible
 * on /study-material: `asDoc` required `groups` and dropped the row silently.
 */
/** One rule of a procedure guide: the carried requirement and what to do. */
export type StudyRule = {
  id: string;
  requirement: string;
  do: string;
  pitfall: string;
};

/** Rules sharing a stage of the work — the axis a procedure guide organises by. */
export type StudyStage = {
  id: string;
  heading: string;
  why_this_stage: string;
  rules: StudyRule[];
};

export type StudyDoc =
  | { kind: "guide"; title: string; intro: string; groups: StudyGroup[] }
  | { kind: "sections"; title: string; intro: string; sections: StudySection[] }
  | { kind: "procedure"; title: string; intro: string; stages: StudyStage[] };

export type StudyMaterial = {
  id: string;
  paperId: string;
  textField: "diuni" | "mahoti" | "open_questions";
  updatedAt: string;
  doc: StudyDoc;
};

/** A contents-page entry: enough to choose from, without the whole document. */
export type StudyMaterialSummary = {
  id: string;
  paperId: string;
  /**
   * What the document is CALLED, as distinct from what its opening headline
   * says. `paper_id` is the source filename, which is the name the material is
   * known by — "טעויות לשון כתיבה משפטית". `doc.title` is the headline LawPass
   * wrote for the page itself ("למה דווקא כאן אתה נכשל?"), which is right at the
   * top of the document and wrong in a list of documents.
   */
  name: string;
  textField: StudyMaterial["textField"];
  title: string;
  intro: string;
  /** Which shape the document is — the list labels its counts by this. */
  kind: StudyDoc["kind"];
  groupCount: number;
  itemCount: number;
  updatedAt: string;
};

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The view stores the document as jsonb, so what comes back is `unknown` as far
 * as the type system is concerned. These narrow it rather than asserting it: a
 * row written by an older version of the pipeline, or half-written by hand,
 * should drop out of the list instead of throwing on the page.
 */
function asItem(value: unknown): StudyItem | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.avoid !== "string" || typeof v.use !== "string") return null;
  return {
    id: typeof v.id === "string" ? v.id : `${v.avoid}`,
    avoid: v.avoid,
    use: v.use,
    reason: typeof v.reason === "string" ? v.reason : "",
    example: typeof v.example === "string" ? v.example : "",
    exam_note: typeof v.exam_note === "string" ? v.exam_note : "",
  };
}

/** A section of a verbatim document, or null when it holds nothing to read. */
function asSection(value: unknown, at: number): StudySection | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const paragraphs = Array.isArray(v.paragraphs)
    ? v.paragraphs.filter((p): p is string => typeof p === "string" && p.trim() !== "")
    : [];
  const tables = Array.isArray(v.tables)
    ? (v.tables as Record<string, unknown>[])
        .filter((t) => t && Array.isArray(t.rows) && t.rows.length > 0)
        .map((t) => ({
          columns: Array.isArray(t.columns)
            ? (t.columns as unknown[]).map((c) => String(c))
            : null,
          rows: t.rows as (string[] | Record<string, string>)[],
        }))
    : [];
  const heading = typeof v.heading === "string" ? v.heading : "";

  // A heading with nothing under it is a page artefact, not a section.
  if (!heading && paragraphs.length === 0 && tables.length === 0) return null;
  return { id: `s${at}`, heading, paragraphs, tables };
}

function asRule(value: unknown, at: number): StudyRule | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.requirement !== "string" || !v.requirement.trim()) return null;
  return {
    id: typeof v.id === "string" && v.id ? v.id : `r${at}`,
    requirement: v.requirement,
    do: typeof v.do === "string" ? v.do : "",
    pitfall: typeof v.pitfall === "string" ? v.pitfall : "",
  };
}

function asDoc(value: unknown): StudyDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  // procedure_guide (contract v1.3+): stages of the candidate's own workflow.
  if (Array.isArray(v.stages)) {
    const stages: StudyStage[] = [];
    for (const [at, raw] of v.stages.entries()) {
      if (typeof raw !== "object" || raw === null) continue;
      const g = raw as Record<string, unknown>;
      const rules = Array.isArray(g.rules)
        ? g.rules.map(asRule).filter((r): r is StudyRule => r !== null)
        : [];
      if (rules.length === 0) continue;
      stages.push({
        id: typeof g.id === "string" && g.id ? g.id : `s${at}`,
        heading: typeof g.heading === "string" ? g.heading : "",
        why_this_stage: typeof g.why_this_stage === "string" ? g.why_this_stage : "",
        rules,
      });
    }
    if (stages.length === 0) return null;
    return {
      kind: "procedure",
      title: typeof v.title === "string" ? v.title : "חומר לימוד",
      intro: typeof v.intro === "string" ? v.intro : "",
      stages,
    };
  }

  // The verbatim shape: sections rather than groups of pairs.
  if (!Array.isArray(v.groups) && Array.isArray(v.sections)) {
    const sections = v.sections
      .map((raw, at) => asSection(raw, at))
      .filter((s): s is StudySection => s !== null);
    if (sections.length === 0) return null;
    return {
      kind: "sections",
      // A verbatim document has no authored title or intro — it was copied,
      // not written — so the page falls back to naming it by its source.
      title: typeof v.title === "string" ? v.title : "",
      intro: typeof v.intro === "string" ? v.intro : "",
      sections,
    };
  }

  if (!Array.isArray(v.groups)) return null;

  const groups: StudyGroup[] = [];
  for (const raw of v.groups) {
    if (typeof raw !== "object" || raw === null) continue;
    const g = raw as Record<string, unknown>;
    const items = Array.isArray(g.items)
      ? g.items.map(asItem).filter((i): i is StudyItem => i !== null)
      : [];
    if (items.length === 0) continue;
    groups.push({
      id: typeof g.id === "string" ? g.id : `${groups.length}`,
      heading: typeof g.heading === "string" ? g.heading : "",
      why_this_group: typeof g.why_this_group === "string" ? g.why_this_group : "",
      items,
    });
  }
  if (groups.length === 0) return null;

  return {
    kind: "guide",
    title: typeof v.title === "string" ? v.title : "חומר לימוד",
    intro: typeof v.intro === "string" ? v.intro : "",
    groups,
  };
}

/**
 * The two numbers under a document's name in the contents list.
 *
 * They mean different things per kind, and the list says which: a guide is
 * counted in נושאים and פריטים, a verbatim document in פרקים. Reporting
 * "0 פריטים" for a document that has no items would read as an empty document
 * rather than a different kind of one.
 */
function counts(doc: StudyDoc): { groupCount: number; itemCount: number } {
  if (doc.kind === "sections") {
    return { groupCount: doc.sections.length, itemCount: 0 };
  }
  if (doc.kind === "procedure") {
    return {
      groupCount: doc.stages.length,
      itemCount: doc.stages.reduce((n, s) => n + s.rules.length, 0),
    };
  }
  return {
    groupCount: doc.groups.length,
    itemCount: doc.groups.reduce((n, g) => n + g.items.length, 0),
  };
}

/**
 * A filename turned back into a name.
 *
 * paper_id comes from the source document's filename, so it carries the
 * underscores a filename needs and a reader does not.
 */
export function documentName(paperId: string): string {
  return paperId.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Everything a candidate may study, newest first.
 *
 * `textField` filters to one part of the product; omitting it lists all of
 * them, which is what the index page wants while only one kind exists.
 */
export async function listStudyMaterial(
  supabase: Client,
  textField?: StudyMaterial["textField"]
): Promise<StudyMaterialSummary[]> {
  let query = supabase
    .from("study_material_public")
    .select("study_material_id, paper_id, text_field, doc, updated_at")
    .order("updated_at", { ascending: false });

  if (textField) query = query.eq("text_field", textField);

  const { data, error } = await query;
  if (error) throw new Error(`study material could not be read: ${error.message}`);

  const out: StudyMaterialSummary[] = [];
  for (const row of data ?? []) {
    const doc = asDoc(row.doc);
    if (!doc) continue;
    const paperId = row.paper_id as string;
    out.push({
      id: row.study_material_id as string,
      paperId,
      name: documentName(paperId),
      textField: row.text_field as StudyMaterial["textField"],
      title: doc.title,
      intro: doc.intro,
      kind: doc.kind,
      ...counts(doc),
      updatedAt: row.updated_at as string,
    });
  }
  return out;
}

/** One document in full, or null when it does not exist or has no usable content. */
export async function getStudyMaterial(
  supabase: Client,
  id: string
): Promise<StudyMaterial | null> {
  const { data, error } = await supabase
    .from("study_material_public")
    .select("study_material_id, paper_id, text_field, doc, updated_at")
    .eq("study_material_id", id)
    .maybeSingle();

  if (error) throw new Error(`study material could not be read: ${error.message}`);
  if (!data) return null;

  const doc = asDoc(data.doc);
  if (!doc) return null;

  return {
    id: data.study_material_id as string,
    paperId: data.paper_id as string,
    textField: data.text_field as StudyMaterial["textField"],
    updatedAt: data.updated_at as string,
    doc,
  };
}

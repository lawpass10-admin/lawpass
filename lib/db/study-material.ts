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

export type StudyDoc = {
  title: string;
  intro: string;
  groups: StudyGroup[];
};

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

function asDoc(value: unknown): StudyDoc | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
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
    title: typeof v.title === "string" ? v.title : "חומר לימוד",
    intro: typeof v.intro === "string" ? v.intro : "",
    groups,
  };
}

const countItems = (doc: StudyDoc) => doc.groups.reduce((n, g) => n + g.items.length, 0);

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
      groupCount: doc.groups.length,
      itemCount: countItems(doc),
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

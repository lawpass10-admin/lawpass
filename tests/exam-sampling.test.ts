import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bucketAndShuffleExamPool,
  sampleExamQuestions,
  type ExamPoolItem,
} from "@/lib/db/exam";
import { EXAM_CLUSTERS, EXAM_TOTAL_QUESTIONS } from "@/lib/exam/clusters";

/**
 * Build a fixture pool that mimics today's production shape:
 *   civil_proc:           14 sources × 5 angles = 70 items   (cluster א)
 *   criminal_proc:        11 × 5 = 55                        (cluster ב)
 *   evidence:              4 × 5 = 20                        (cluster ב)
 *   constitutional_intl:   5 × 5 = 25                        (cluster ב)
 *   execution:             5 × 5 = 25                        (cluster ג)
 *   insolvency_arbitration:0                                 (cluster ג)
 *
 * Cluster sizes: א=70, ב=100, ג=25 — all comfortably above their
 * 14/11/13 targets.
 */
function buildProductionLikePool(): ExamPoolItem[] {
  const counts: Record<string, number> = {
    civil_proc: 14,
    criminal_proc: 11,
    evidence: 4,
    constitutional_intl: 5,
    execution: 5,
    insolvency_arbitration: 0,
  };
  const pool: ExamPoolItem[] = [];
  for (const [chapter, sources] of Object.entries(counts)) {
    for (let i = 0; i < sources; i++) {
      const srcId = `${chapter}-src-${i}`;
      pool.push({
        question_type: "source",
        question_id: srcId,
        chapter_code: chapter,
      });
      // 5 angles per source — matches the prod ratio.
      for (let a = 0; a < 5; a++) {
        pool.push({
          question_type: "angle",
          question_id: `${chapter}-ang-${i}-${a}`,
          chapter_code: chapter,
        });
      }
    }
  }
  return pool;
}

function countByCluster(items: ExamPoolItem[]): Record<string, number> {
  const out: Record<string, number> = { א: 0, ב: 0, ג: 0 };
  for (const it of items) {
    for (const cluster of EXAM_CLUSTERS) {
      if (cluster.chapter_codes.includes(it.chapter_code)) {
        out[cluster.code]++;
        break;
      }
    }
  }
  return out;
}

describe("bucketAndShuffleExamPool — production-like pool", () => {
  it("hits at least cluster targets (14/11/13) + 2 padding = total 40", () => {
    // The bar-exam weights round to 14 + 11 + 13 = 38 cluster-allocated
    // questions; the remaining 2 are picked from the global leftover
    // pool in the padding pass. So each cluster ends up with AT LEAST
    // its target, and the total is exactly EXAM_TOTAL_QUESTIONS.
    const result = bucketAndShuffleExamPool(buildProductionLikePool());
    expect(result.length).toBe(EXAM_TOTAL_QUESTIONS);
    const byCluster = countByCluster(result);
    expect(byCluster["א"]).toBeGreaterThanOrEqual(14);
    expect(byCluster["ב"]).toBeGreaterThanOrEqual(11);
    expect(byCluster["ג"]).toBeGreaterThanOrEqual(13);
    expect(byCluster["א"] + byCluster["ב"] + byCluster["ג"]).toBe(
      EXAM_TOTAL_QUESTIONS
    );
    // The 2 padding picks land somewhere; the total over-allocation
    // versus the strict cluster targets is exactly 2.
    const overAllocation =
      byCluster["א"] - 14 + (byCluster["ב"] - 11) + (byCluster["ג"] - 13);
    expect(overAllocation).toBe(2);
  });

  it("returns 40 items with no duplicate (type, id) pairs", () => {
    const result = bucketAndShuffleExamPool(buildProductionLikePool());
    const keys = new Set(
      result.map((it) => `${it.question_type}:${it.question_id}`)
    );
    expect(keys.size).toBe(EXAM_TOTAL_QUESTIONS);
  });

  it("draws from both source and angle types", () => {
    // Smoke check that the unified pool isn't all-source or all-angle.
    // Probabilistically this could flake on a degenerate shuffle, but
    // with 40 picks out of a pool that's ~14% source / ~86% angle, the
    // chance of an all-one-type result is vanishingly small.
    const result = bucketAndShuffleExamPool(buildProductionLikePool());
    const types = new Set(result.map((it) => it.question_type));
    expect(types.size).toBe(2);
  });
});

describe("bucketAndShuffleExamPool — starved cluster (ג)", () => {
  /**
   * Drop both ג chapters to 1 source each → 2 sources × (1 + 5 angles
   * each) = 12 items total in cluster ג. Target is 13 → cluster ג is
   * 1 short. The global pad path should backfill from leftover items.
   */
  function buildStarvedGPool(): ExamPoolItem[] {
    const counts: Record<string, number> = {
      civil_proc: 20, // bigger pad pool
      criminal_proc: 20,
      evidence: 0,
      constitutional_intl: 0,
      execution: 1,
      insolvency_arbitration: 1,
    };
    const pool: ExamPoolItem[] = [];
    for (const [chapter, sources] of Object.entries(counts)) {
      for (let i = 0; i < sources; i++) {
        pool.push({
          question_type: "source",
          question_id: `${chapter}-src-${i}`,
          chapter_code: chapter,
        });
        for (let a = 0; a < 5; a++) {
          pool.push({
            question_type: "angle",
            question_id: `${chapter}-ang-${i}-${a}`,
            chapter_code: chapter,
          });
        }
      }
    }
    return pool;
  }

  it("takes ALL of cluster ג's items when the pool is starved, then pads the rest from leftovers", () => {
    const pool = buildStarvedGPool();
    const allG = pool.filter((p) =>
      ["execution", "insolvency_arbitration"].includes(p.chapter_code)
    );
    expect(allG.length).toBe(12); // 2 sources × 6 items each

    const result = bucketAndShuffleExamPool(pool);
    expect(result.length).toBe(EXAM_TOTAL_QUESTIONS);

    // Every ג item from the pool ended up in the result (cluster
    // picks take all available when target > pool).
    const allGKeys = new Set(
      allG.map((p) => `${p.question_type}:${p.question_id}`)
    );
    const resultGKeys = new Set(
      result
        .filter((p) =>
          ["execution", "insolvency_arbitration"].includes(p.chapter_code)
        )
        .map((p) => `${p.question_type}:${p.question_id}`)
    );
    for (const k of allGKeys) expect(resultGKeys.has(k)).toBe(true);

    // ג target was 13 but only 12 available → all 12 picked. The
    // missing 1 ג slot + the 2 default-padding slots (per-cluster
    // targets sum to 38, not 40) = 3 questions backfilled from
    // א or ב leftovers — so the result still has exactly 40 items
    // and the א + ב count is 14 + 11 + 3 = 28.
    const byCluster = countByCluster(result);
    expect(byCluster["ג"]).toBe(12);
    expect(byCluster["א"] + byCluster["ב"]).toBe(28);
  });

  it("throws when total pool < EXAM_TOTAL_QUESTIONS", () => {
    // 5 items total — can't make 40.
    const tinyPool: ExamPoolItem[] = Array.from({ length: 5 }, (_, i) => ({
      question_type: "source" as const,
      question_id: `x-${i}`,
      chapter_code: "civil_proc",
    }));
    expect(() => bucketAndShuffleExamPool(tinyPool)).toThrow(
      "exam_pool_insufficient"
    );
  });
});

describe("sampleExamQuestions — procedural-only guard", () => {
  /**
   * Substantive-law chapters (contracts, property, etc — introduced by
   * migration 20260526000001) live in the same `source_questions`
   * table as procedural questions. They must NEVER appear in the
   * 40-question bar-exam simulation: not in cluster picks (impossible
   * — their codes are not in any cluster's chapter_codes), and not in
   * the global padding pass either. This regression test seeds the
   * mocked DB with a substantive source + a substantive angle and
   * asserts both are absent from the final list.
   */

  type SrcRow = {
    id: string;
    chapter: { code: string; track: "procedural" | "substantive" };
  };
  type AngleRow = { id: string; source_question_id: string };

  function buildFakeSupabase(srcRows: SrcRow[], angleRows: AngleRow[]) {
    function thenable<T>(data: T) {
      const builder: Record<string, unknown> = {};
      const passthrough = () => builder;
      builder.select = passthrough;
      builder.eq = passthrough;
      builder.in = passthrough;
      builder.then = (resolve: (v: { data: T; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve);
      return builder;
    }
    return {
      from: (table: string) => {
        if (table === "source_questions") return thenable(srcRows);
        if (table === "angle_questions") return thenable(angleRows);
        throw new Error(`unexpected from() call: ${table}`);
      },
    };
  }

  it("never includes substantive-track questions, even via padding", async () => {
    // Production-shaped procedural pool (39 sources × 5 angles each =
    // 234 candidates) — comfortably above the 14/11/13 cluster targets.
    const proceduralCounts: Record<string, number> = {
      civil_proc: 14,
      criminal_proc: 11,
      evidence: 4,
      constitutional_intl: 5,
      execution: 5,
      insolvency_arbitration: 0,
    };

    const srcRows: SrcRow[] = [];
    const angleRows: AngleRow[] = [];
    for (const [code, count] of Object.entries(proceduralCounts)) {
      for (let i = 0; i < count; i++) {
        const sid = `${code}-src-${i}`;
        srcRows.push({
          id: sid,
          chapter: { code, track: "procedural" },
        });
        for (let a = 0; a < 5; a++) {
          angleRows.push({
            id: `${code}-ang-${i}-${a}`,
            source_question_id: sid,
          });
        }
      }
    }

    // The "do not let through" markers: 1 substantive source + 1
    // substantive angle hanging off it. Cluster picks cannot reach
    // them (no cluster contains "contracts"), and padding cannot
    // either if `sampleExamQuestions` correctly filters them out
    // BEFORE building the pool.
    const SUBSTANTIVE_SRC_ID = "contracts-substantive-src";
    const SUBSTANTIVE_ANGLE_ID = "contracts-substantive-ang";
    srcRows.push({
      id: SUBSTANTIVE_SRC_ID,
      chapter: { code: "contracts", track: "substantive" },
    });
    angleRows.push({
      id: SUBSTANTIVE_ANGLE_ID,
      source_question_id: SUBSTANTIVE_SRC_ID,
    });

    const fakeSupabase = buildFakeSupabase(srcRows, angleRows);
    // `sampleExamQuestions` is typed against the SSR client; we widen
    // here because the fake only implements the subset the sampler
    // actually calls.
    const result = await sampleExamQuestions(
      fakeSupabase as unknown as Parameters<typeof sampleExamQuestions>[0]
    );

    expect(result.length).toBe(EXAM_TOTAL_QUESTIONS);
    const ids = new Set(result.map((r) => r.question_id));
    expect(ids.has(SUBSTANTIVE_SRC_ID)).toBe(false);
    expect(ids.has(SUBSTANTIVE_ANGLE_ID)).toBe(false);
  });
});

describe("bucketAndShuffleExamPool — randomisation", () => {
  // We stub Math.random with two different seeded streams so the test
  // is deterministic across machines but still distinguishable between
  // calls. The shuffle should produce visibly different orderings.
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, "random");
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  function seeded(seed: number): () => number {
    // Tiny LCG — good enough to make two distinct shuffles.
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return ((state >>> 0) / 0x100000000) % 1;
    };
  }

  it("produces different orderings across calls with different RNG streams", () => {
    const pool = buildProductionLikePool();

    randomSpy.mockImplementation(seeded(1));
    const a = bucketAndShuffleExamPool(pool).map((it) => it.question_id);

    randomSpy.mockImplementation(seeded(2));
    const b = bucketAndShuffleExamPool(pool).map((it) => it.question_id);

    expect(a).not.toEqual(b);
  });

  it("each ordering still respects cluster minimums (≥ 14/11/13, total 40)", () => {
    const pool = buildProductionLikePool();

    function assertOk(b: ReturnType<typeof countByCluster>): void {
      expect(b["א"]).toBeGreaterThanOrEqual(14);
      expect(b["ב"]).toBeGreaterThanOrEqual(11);
      expect(b["ג"]).toBeGreaterThanOrEqual(13);
      expect(b["א"] + b["ב"] + b["ג"]).toBe(EXAM_TOTAL_QUESTIONS);
    }

    randomSpy.mockImplementation(seeded(7));
    assertOk(countByCluster(bucketAndShuffleExamPool(pool)));

    randomSpy.mockImplementation(seeded(99));
    assertOk(countByCluster(bucketAndShuffleExamPool(pool)));
  });
});

"use strict";

// Re-validate a rejected answer with the CURRENT rules and promote it if it now
// passes.
//
//   node scripts/promote-rejected-answer.js <rejected.json> <question.json> <source-questions.json>
//
// Exists because a rejection can be the validator's fault, not the model's. When
// a check is corrected, the work already paid for should not have to be
// regenerated — but it must be re-checked, never simply moved.

const fs = require("node:fs");
const path = require("node:path");

const { buildBank, validateGenerated, renderGenerated } = require("../lib/ai/quote-bank");
const { findIncompleteAnswer } = require("../lib/ai/generate-open-answer");

function main() {
  const [rejectedPath, questionPath, sourcePath] = process.argv.slice(2);
  if (!rejectedPath || !questionPath || !sourcePath) {
    console.error(
      "usage: node scripts/promote-rejected-answer.js <rejected.json> <question.json> <source-questions.json>"
    );
    process.exit(2);
  }

  const rejected = JSON.parse(fs.readFileSync(rejectedPath, "utf8"));
  const answer = rejected.generated;
  if (!answer) throw new Error(`no "generated" payload in ${rejectedPath}`);

  const qPayload = JSON.parse(fs.readFileSync(questionPath, "utf8"));
  const question = qPayload.questions?.[0] || qPayload.generated;
  const sourceId = qPayload.generated_from?.source_external_id || question.parent_question_id;

  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const bank = buildBank(sourceData.quotes, sourceId);

  const validation = validateGenerated(answer, bank, {});
  const incomplete = findIncompleteAnswer(answer);

  if (!validation.ok || incomplete.length) {
    console.error("STILL INVALID under the current rules — not promoted:\n");
    for (const e of [...validation.errors, ...incomplete]) {
      console.error(`  [${e.type}] ${e.detail}`);
    }
    process.exit(1);
  }

  const merged = {
    generated_from: {
      ...(qPayload.generated_from || {}),
      answer: {
        ...Object.fromEntries(
          Object.entries(rejected).filter(
            ([k]) => !["generated", "errors", "rejected_at", "usage"].includes(k)
          )
        ),
        usage: rejected.usage,
        originally_rejected_at: rejected.rejected_at,
        promoted_at: new Date().toISOString(),
        promoted_from: path.basename(rejectedPath),
      },
    },
    questions: [question],
    answers: [
      {
        external_id: `${question.external_id}-ANS`,
        question_external_id: question.external_id,
        origin: "generated",
        status: "draft",
        quote_ids: bank.map((q) => q.id),
        ...answer,
      },
    ],
    rendered_preview: renderGenerated(answer, bank),
  };

  const outPath = path.join(
    path.dirname(path.resolve(rejectedPath)),
    "..",
    `${question.external_id}.answer.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

  console.log(
    `re-validated OK — ${validation.verified.length} verified quotation(s), no misquotation`
  );
  console.log(`promoted to ${path.normalize(outPath)}`);
}

main();

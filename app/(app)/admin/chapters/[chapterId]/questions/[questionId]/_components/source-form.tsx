"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { adminEditSourceContentAction } from "@/app/(app)/admin/chapters/[chapterId]/questions/[questionId]/_actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionEditorSource } from "@/lib/db/admin";

import ContextBlock from "./context-block";

const TEXT_MAX = 10_000;
const ARRAY_TEXTAREA_MAX = 20_000;

/**
 * Client-side form schema: every field is a string (the textarea
 * value). The server action's Zod re-parses + transforms array
 * fields via newline-split. RHF only sees strings; submit handler
 * forwards them as-is.
 */
const sourceFormSchema = z.object({
  legal_topic_analysis: z.string().max(TEXT_MAX),
  full_explanation: z.string().max(TEXT_MAX),
  common_pitfall: z.string().max(TEXT_MAX),
  summary_for_memory: z.string().max(TEXT_MAX),
  quick_thinking_360: z.string().max(TEXT_MAX),
  notes_for_admin: z.string().max(TEXT_MAX),
  concepts_and_skills: z.string().max(ARRAY_TEXTAREA_MAX),
  references_list: z.string().max(ARRAY_TEXTAREA_MAX),
});

type SourceFormInput = z.infer<typeof sourceFormSchema>;

export default function SourceForm({ source }: { source: QuestionEditorSource }) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SourceFormInput>({
    resolver: zodResolver(sourceFormSchema),
    mode: "onTouched",
    defaultValues: {
      legal_topic_analysis: source.legalTopicAnalysis,
      full_explanation: source.fullExplanation,
      common_pitfall: source.commonPitfall,
      summary_for_memory: source.summaryForMemory,
      quick_thinking_360: source.quickThinking360,
      notes_for_admin: source.notesForAdmin,
      concepts_and_skills: source.conceptsAndSkills.join("\n"),
      references_list: source.referencesList.join("\n"),
    },
  });

  async function onSubmit(values: SourceFormInput) {
    setSubmitting(true);
    const result = await adminEditSourceContentAction({
      sourceQuestionId: source.id,
      ...values,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("השינויים נשמרו");
    form.reset(values);
  }

  return (
    <div className="space-y-5">
      <ContextBlock
        questionText={source.questionText}
        choices={source.choices}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="legal_topic_analysis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ניתוח הנושא המשפטי</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="full_explanation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>הסבר משפטי מלא</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={6} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="common_pitfall"
            render={({ field }) => (
              <FormItem>
                <FormLabel>מלכודת נפוצה</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quick_thinking_360"
            render={({ field }) => (
              <FormItem>
                <FormLabel>חשיבה מהירה 360°</FormLabel>
                {/* Slice 7.6 — render-time parser splits on
                    **וריאציה N — title:** ← and turns each into a
                    reveal card. Admins should keep this pattern when
                    editing; rows without it fall back to a single
                    block render. */}
                <p className="text-xs text-muted-foreground" dir="rtl">
                  השדה ירונדר כווריאציות נפרדות. תבנית:
                  <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]" dir="ltr">
                    **וריאציה N — כותרת:**
                  </code>
                  שאלה?{" "}
                  <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]" dir="ltr">
                    ←
                  </code>{" "}
                  תשובה.
                </p>
                <FormControl>
                  <Textarea dir="auto" rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="summary_for_memory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>מבט מסכם לזכירה</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="concepts_and_skills"
            render={({ field }) => (
              <FormItem>
                <FormLabel>מושגים ומיומנויות</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={4} {...field} />
                </FormControl>
                <FormDescription>פריט אחד בכל שורה.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="references_list"
            render={({ field }) => (
              <FormItem>
                <FormLabel>רפרנסים</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={4} {...field} />
                </FormControl>
                <FormDescription>פריט אחד בכל שורה.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes_for_admin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>הערות לאדמין</FormLabel>
                <FormControl>
                  <Textarea dir="auto" rows={3} {...field} />
                </FormControl>
                <FormDescription>
                  שדה פנימי — לא מוצג למשתמשים.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={submitting}
              className="btn-gold h-10 rounded-full px-6 font-heebo font-semibold"
            >
              {submitting ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

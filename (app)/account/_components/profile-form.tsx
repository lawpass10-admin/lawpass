"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateProfileAction } from "@/lib/api/account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  editProfileSchema,
  type EditProfileInput,
} from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

// Clearable sentinel: Base UI Select treats "" as uncontrolled, so the
// "clear" item ships a non-empty value that the change handler maps back
// to "" before committing to state.
const CLEAR_VALUE = "__clear__";

/**
 * Splits a profiles.exam_date_planned DATE ("YYYY-MM-01" or null) into
 * the month + year parts used by the dual-<Select> picker below.
 */
function splitExamDate(value: string | null): { month: string; year: string } {
  if (!value) return { month: "", year: "" };
  // The DB stores DATE; Postgrest serializes as "YYYY-MM-DD". We treat
  // anything that isn't shape-matching as empty rather than crashing.
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match) return { month: "", year: "" };
  return { year: match[1]!, month: match[2]! };
}

export default function ProfileForm({
  defaultFullName,
  defaultExamDate,
}: {
  defaultFullName: string;
  defaultExamDate: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);

  const initial = splitExamDate(defaultExamDate);
  const [examMonth, setExamMonth] = useState<string>(initial.month);
  const [examYear, setExamYear] = useState<string>(initial.year);

  const form = useForm<EditProfileInput>({
    resolver: zodResolver(editProfileSchema),
    mode: "onTouched",
    defaultValues: {
      full_name: defaultFullName,
      // Normalize DB "YYYY-MM-DD" → schema-accepted "YYYY-MM-01". The
      // column should already store first-of-month per the signup flow,
      // but the schema regex is strict so we re-stitch from the split.
      exam_date_planned:
        initial.month && initial.year
          ? `${initial.year}-${initial.month}-01`
          : null,
    },
  });

  // Sync month + year selects → exam_date_planned form field (YYYY-MM-01
  // or null). Same pattern as complete-profile-form.tsx.
  useEffect(() => {
    const value =
      examMonth && examYear ? `${examYear}-${examMonth}-01` : null;
    form.setValue("exam_date_planned", value, { shouldValidate: false });
  }, [examMonth, examYear, form]);

  async function onSubmit(values: EditProfileInput) {
    setSubmitting(true);
    const result = await updateProfileAction(values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("השינויים נשמרו");
    form.reset(values);
  }

  // Year options for exam_date_planned — current year + next 3.
  const currentYear = new Date().getFullYear();
  const examYearOptions = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטים אישיים</CardTitle>
        <CardDescription>
          שם התצוגה מופיע בסרגל הצד; מועד הבחינה מזין את ספירת הימים בדשבורד.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exam_date_planned"
              render={() => (
                <FormItem>
                  <FormLabel>מועד בחינה הקרוב (אופציונלי)</FormLabel>
                  <div className="flex gap-2">
                    <Select
                      value={examMonth}
                      onValueChange={(v) => {
                        const next = v ?? "";
                        setExamMonth(next === CLEAR_VALUE ? "" : next);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="חודש" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CLEAR_VALUE}>— ללא —</SelectItem>
                        {HEBREW_MONTHS.map((m, i) => (
                          <SelectItem
                            key={m}
                            value={String(i + 1).padStart(2, "0")}
                          >
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={examYear}
                      onValueChange={(v) => {
                        const next = v ?? "";
                        setExamYear(next === CLEAR_VALUE ? "" : next);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="שנה" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CLEAR_VALUE}>— ללא —</SelectItem>
                        {examYearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={submitting}
                className={cn(
                  "btn-gold h-10 rounded-full px-6 font-heebo font-semibold"
                )}
              >
                {submitting ? "שומר..." : "שמור שינויים"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

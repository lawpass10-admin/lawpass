"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type DefaultValues,
  useForm,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";

import { completeGoogleOAuthSignup } from "@/app/(auth)/_actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACADEMIC_INSTITUTIONS,
  getAcademicInstitutionLabel,
} from "@/lib/profile/institutions";
import {
  LEGAL_SPECIALIZATIONS,
  getLegalSpecializationLabel,
} from "@/lib/profile/specializations";
import {
  oauthCompletionSchema,
  type OAuthCompletionInput,
} from "@/lib/validators/auth";

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

// Birth-year range for the year dropdown. Lower bound 1940 mirrors the
// previous Calendar's startMonth; upper bound enforces the 18+ rule (the
// Zod schema does the strict comparison — this just keeps invalid years
// out of the UI). Computed once at module load; staleness across a year
// boundary self-corrects on the next deploy / hard refresh, acceptable
// trade-off vs. the complexity of recomputing per-render.
const MIN_BIRTH_YEAR = 1940;
const MAX_BIRTH_YEAR = new Date().getFullYear() - 18;
const yearOptions = Array.from(
  { length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 },
  (_, i) => MAX_BIRTH_YEAR - i
);

/** Days in a calendar month. month is 1-indexed (1=Jan, 12=Dec). Trick:
 *  new Date(year, month, 0) returns the LAST day of (month-1) in JS's
 *  0-indexed month convention, which equals the last day of the
 *  1-indexed `month` we passed in. Used to truncate the day Select when
 *  the user changes year/month and the previous day is now invalid
 *  (e.g., Feb 30 → Feb 28/29 on month switch, Feb 29 in a leap year →
 *  Feb 28 on year switch). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function CompleteProfileForm({
  defaultFullName,
}: {
  defaultFullName: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  // Local mirrors for the month/year selects. Combined into a YYYY-MM-01
  // string and pushed into the form's exam_date_planned field when both
  // are set; null when either is empty.
  const [examMonth, setExamMonth] = useState<string>("");
  const [examYear, setExamYear] = useState<string>("");

  // gender is initialized to "" (not undefined) so the form is controlled
  // from first render — same string the RadioGroup sees via field.value ?? "".
  // The cast is necessary because OAuthCompletionInput["gender"] is a strict
  // enum; Zod still rejects "" on submit (z.enum's allowlist), which is the
  // intended UX (user must pick one before submit).
  // terms_accepted stays undefined — Zod requires literal(true), so undefined
  // and false both fail submit; the controlled state question doesn't apply
  // to a Checkbox the same way.
  const defaultValues = {
    full_name: defaultFullName,
    phone: "",
    gender: "",
    birth_date: "",
    exam_date_planned: null,
    // Slice 13 — initialized to "" (not undefined) so the controlled
    // <Select> binds cleanly from first render. Zod's enum rejects ""
    // on submit; the user must pick a listed id.
    academic_institution: "",
    legal_specialization: "",
  } as unknown as DefaultValues<OAuthCompletionInput>;

  const form = useForm<OAuthCompletionInput>({
    resolver: zodResolver(oauthCompletionSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues,
  });

  // useWatch (rather than form.watch) so React Compiler can safely memoize
  // the disabled-button computation below.
  const termsAccepted = useWatch({
    control: form.control,
    name: "terms_accepted",
  });

  // Sync month + year selects → exam_date_planned form field (YYYY-MM-01 or null).
  useEffect(() => {
    const value =
      examMonth && examYear ? `${examYear}-${examMonth}-01` : null;
    form.setValue("exam_date_planned", value, { shouldValidate: false });
  }, [examMonth, examYear, form]);

  async function onSubmit(values: OAuthCompletionInput) {
    setSubmitting(true);
    // Server Action returns { ok: true, url } or { ok: false, error }. We
    // navigate via window.location instead of having the action redirect
    // because a Server-Action-initiated RSC redirect chain (action →
    // /dashboard → layout-redirect → /pricing) was racing with
    // revalidatePath in production and rendering /pricing empty on first
    // paint. A full page load eliminates the chain.
    const result = await completeGoogleOAuthSignup(values);
    if (!result.ok) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    // .assign() is functionally equivalent to `window.location.href = ...`
    // but the property-assignment form trips react-hooks/immutability
    // when used inside a function declaration in the component body.
    window.location.assign(result.url);
  }

  // Year options for exam_date_planned — current year + next 3. Renamed
  // from the original `yearOptions` to avoid shadowing the module-level
  // birth-year `yearOptions` const used by the birth_date FormField below.
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
        <CardTitle className="text-center">השלמת הרשמה</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר טלפון</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מגדר</FormLabel>
                  <FormControl>
                    {/* TODO(slice-7): same Base UI RadioGroupItem
                        "uncontrolled → controlled value state" warning fires
                        on first selection here as in signup-form Step2. See
                        signup-form.tsx Step2 RadioGroup TODO comment for
                        resolution candidates. Non-blocking. */}
                    <RadioGroup
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      className="grid grid-cols-2 gap-2"
                    >
                      {(
                        [
                          { value: "male", label: "זכר" },
                          { value: "female", label: "נקבה" },
                          { value: "other", label: "אחר" },
                          { value: "prefer_not_to_say", label: "מעדיף לא לציין" },
                        ] as const
                      ).map((opt) => {
                        const id = `gender-${opt.value}`;
                        return (
                          <div
                            key={opt.value}
                            className="flex items-center gap-2 rounded-md border p-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                          >
                            <RadioGroupItem value={opt.value} id={id} />
                            <Label
                              htmlFor={id}
                              className="flex-1 cursor-pointer text-sm font-normal"
                            >
                              {opt.label}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תאריך לידה</FormLabel>
                  <BirthDateSelects
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
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
                      onValueChange={(v) => setExamMonth(v ?? "")}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="חודש" />
                      </SelectTrigger>
                      <SelectContent>
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
                      onValueChange={(v) => setExamYear(v ?? "")}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="שנה" />
                      </SelectTrigger>
                      <SelectContent>
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

            {/* Slice 13 — academic institution + legal specialization.
                Placed AFTER exam_date_planned and BEFORE terms_accepted.
                Both REQUIRED — same closed lists the signup wizard uses.

                Slice 13 follow-up — Bug 1: <SelectContent> widens to
                fit the longest Hebrew label (`w-auto`) with a
                trigger-width minimum (`min-w-(--anchor-width)`) and a
                cap to keep the panel sensible at narrow viewports.
                Bug 2: <SelectValue> uses a render-function child to
                resolve the stored id to its Hebrew label so the
                trigger displays e.g. "דיני משפחה" rather than
                "family_law". */}
            <FormField
              control={form.control}
              name="academic_institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מוסד אקדמי</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="בחר/י מוסד">
                          {(value: unknown) =>
                            typeof value === "string" && value
                              ? (getAcademicInstitutionLabel(value) ?? value)
                              : null
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-(--anchor-width) max-w-[min(440px,calc(100vw-2rem))]">
                        {ACADEMIC_INSTITUTIONS.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            {inst.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legal_specialization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תחום התמחות</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="בחר/י תחום">
                          {(value: unknown) =>
                            typeof value === "string" && value
                              ? (getLegalSpecializationLabel(value) ?? value)
                              : null
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-(--anchor-width) max-w-[min(440px,calc(100vw-2rem))]">
                        {LEGAL_SPECIALIZATIONS.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms_accepted"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms_accepted"
                        checked={field.value ?? false}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="terms_accepted"
                        className="cursor-pointer text-sm font-normal leading-snug"
                      >
                        קראתי ואני מסכים/ה ל
                        <Link
                          href="#"
                          target="_blank"
                          className="text-primary hover:underline"
                        >
                          תקנון
                        </Link>{" "}
                        ול
                        <Link
                          href="#"
                          target="_blank"
                          className="text-primary hover:underline"
                        >
                          מדיניות הפרטיות
                        </Link>
                      </Label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                className="ms-auto"
                disabled={submitting || termsAccepted !== true}
              >
                {submitting ? "שולח..." : "הרשם"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Birth-date 3-Select sub-component
// =============================================================================

/**
 * Three-Select date picker (year / month / day) backed by local state per
 * part. Commits to the parent form's birth_date field as "YYYY-MM-DD" only
 * when all three parts are set; otherwise commits "" so partial selections
 * don't trip the schema regex on submit. Validation timing is handled by
 * react-hook-form's mode setting on the parent form — this component does
 * NOT call form.trigger.
 *
 * Day truncation: when the user changes year or month and the previously-
 * selected day exceeds the new month's max (Feb 29 in a leap year →
 * non-leap, Jan 31 → April 30), the day is truncated before commit.
 */
function BirthDateSelects({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const initialParts = value.split("-");
  const [yearPart, setYearPart] = useState<string>(initialParts[0] ?? "");
  const [monthPart, setMonthPart] = useState<string>(initialParts[1] ?? "");
  const [dayPart, setDayPart] = useState<string>(initialParts[2] ?? "");

  function commitIfComplete(y: string, m: string, d: string) {
    if (y && m && d) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  }

  const dayCount =
    yearPart && monthPart
      ? daysInMonth(parseInt(yearPart, 10), parseInt(monthPart, 10))
      : 31;
  const dayOptions = Array.from({ length: dayCount }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );

  return (
    <div className="flex gap-2">
      <Select
        value={yearPart}
        onValueChange={(raw) => {
          const y = raw ?? "";
          setYearPart(y);
          let newDay = dayPart;
          if (y && monthPart && newDay) {
            const maxDay = daysInMonth(
              parseInt(y, 10),
              parseInt(monthPart, 10)
            );
            if (parseInt(newDay, 10) > maxDay) {
              newDay = String(maxDay).padStart(2, "0");
              setDayPart(newDay);
            }
          }
          commitIfComplete(y, monthPart, newDay);
        }}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="שנה" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={monthPart}
        onValueChange={(raw) => {
          const m = raw ?? "";
          setMonthPart(m);
          let newDay = dayPart;
          if (yearPart && m && newDay) {
            const maxDay = daysInMonth(
              parseInt(yearPart, 10),
              parseInt(m, 10)
            );
            if (parseInt(newDay, 10) > maxDay) {
              newDay = String(maxDay).padStart(2, "0");
              setDayPart(newDay);
            }
          }
          commitIfComplete(yearPart, m, newDay);
        }}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="חודש" />
        </SelectTrigger>
        <SelectContent>
          {HEBREW_MONTHS.map((m, i) => (
            <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={dayPart}
        onValueChange={(raw) => {
          const d = raw ?? "";
          setDayPart(d);
          commitIfComplete(yearPart, monthPart, d);
        }}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="יום" />
        </SelectTrigger>
        <SelectContent>
          {dayOptions.map((d) => (
            <SelectItem key={d} value={d}>
              {parseInt(d, 10)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

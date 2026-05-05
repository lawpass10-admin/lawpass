"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { he } from "date-fns/locale";
import { Check, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type DefaultValues,
  type UseFormReturn,
  useForm,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";

import { signInWithGoogleAction, signUpAction } from "@/app/(auth)/_actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  signupSchema,
  signupStep1Schema,
  signupStep2Schema,
  type SignupInput,
} from "@/lib/validators/auth";

type Step = 1 | 2 | 3;

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

const STEP_FIELDS = {
  1: ["email", "password", "confirmPassword"] as const,
  2: ["full_name", "phone", "gender", "birth_date"] as const,
  3: ["exam_date_planned", "terms_accepted"] as const,
};

/** Today − 18 years. Used by both the Calendar disabled matcher and as the
 *  upper bound for the captionLayout="dropdown" year selector. Mirrors the
 *  lexicographic compare in birthDateSchema. */
function maxBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

/** Returns true if a thrown value is the NEXT_REDIRECT marker. Server Actions
 *  signal redirects by throwing this; we let it propagate to Next instead of
 *  surfacing a toast. */
function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// =============================================================================
// Step indicator
// =============================================================================

function StepIndicator({ current }: { current: Step }) {
  return (
    <div
      className="mb-6 flex items-center justify-center gap-1"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label={`שלב ${current} מתוך 3`}
    >
      {([1, 2, 3] as const).map((n, i) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "border border-primary bg-primary/10 text-primary",
                !done && !active && "bg-muted text-muted-foreground"
              )}
              aria-hidden
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            {i < 2 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-8",
                  done ? "bg-primary" : "bg-muted"
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main form
// =============================================================================

export default function SignupForm() {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Local mirrors for the month/year selects on step 3. Combined into a
  // YYYY-MM-01 string and pushed into the form when both are set.
  const [examMonth, setExamMonth] = useState<string>("");
  const [examYear, setExamYear] = useState<string>("");

  const defaultValues: DefaultValues<SignupInput> = {
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    phone: "",
    birth_date: "",
    exam_date_planned: null,
    // gender and terms_accepted intentionally undefined — user must select.
  };

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
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

  /** Validates the current step using the dedicated per-step schema (which
   *  carries any cross-field refines), pushes errors onto the form, and
   *  advances on success. */
  async function handleNext() {
    if (step === 1) {
      const result = signupStep1Schema.safeParse({
        email: form.getValues("email"),
        password: form.getValues("password"),
        confirmPassword: form.getValues("confirmPassword"),
      });
      form.clearErrors([...STEP_FIELDS[1]]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path[0];
          if (
            path === "email" ||
            path === "password" ||
            path === "confirmPassword"
          ) {
            form.setError(path, { message: issue.message });
          }
        }
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const result = signupStep2Schema.safeParse({
        full_name: form.getValues("full_name"),
        phone: form.getValues("phone"),
        gender: form.getValues("gender"),
        birth_date: form.getValues("birth_date"),
      });
      form.clearErrors([...STEP_FIELDS[2]]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path[0];
          if (
            path === "full_name" ||
            path === "phone" ||
            path === "gender" ||
            path === "birth_date"
          ) {
            form.setError(path, { message: issue.message });
          }
        }
        return;
      }
      setStep(3);
    }
  }

  function handleBack() {
    if (step > 1) setStep((step - 1) as Step);
  }

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    try {
      const result = await signUpAction(values);
      // Server Action either redirects (success — throws NEXT_REDIRECT) or
      // returns { ok: false, error }. The redirect path doesn't reach here.
      if (result?.ok === false) {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      if (!isNextRedirect(err)) {
        toast.error("אירעה שגיאה. נסה שוב");
        setSubmitting(false);
      }
      // NEXT_REDIRECT: let it bubble up so Next handles the navigation.
      throw err;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">הרשמה ל-LawPass</CardTitle>
      </CardHeader>
      <CardContent>
        <StepIndicator current={step} />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {step === 1 && <Step1 form={form} />}
            {step === 2 && (
              <Step2
                form={form}
                calendarOpen={calendarOpen}
                setCalendarOpen={setCalendarOpen}
              />
            )}
            {step === 3 && (
              <Step3
                form={form}
                examMonth={examMonth}
                setExamMonth={setExamMonth}
                examYear={examYear}
                setExamYear={setExamYear}
              />
            )}

            <div className="flex items-center gap-2 pt-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={submitting}
                >
                  חזרה
                </Button>
              )}
              {step < 3 ? (
                <Button
                  type="button"
                  className="ms-auto"
                  onClick={handleNext}
                >
                  המשך
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="ms-auto"
                  disabled={submitting || termsAccepted !== true}
                >
                  {submitting ? "שולח..." : "הרשם"}
                </Button>
              )}
            </div>
          </form>
        </Form>

        {step === 1 && (
          <>
            <Separator className="my-6" />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={oauthSubmitting}
              onClick={async () => {
                setOauthSubmitting(true);
                try {
                  const result = await signInWithGoogleAction();
                  // Server Action redirects to Google on success — throws
                  // NEXT_REDIRECT, doesn't reach here. Only failure paths
                  // return ActionResult.
                  if (result?.ok === false) {
                    toast.error(result.error);
                    setOauthSubmitting(false);
                  }
                } catch (err) {
                  if (!isNextRedirect(err)) {
                    toast.error("אירעה שגיאה. נסה שוב");
                    setOauthSubmitting(false);
                  }
                  throw err;
                }
              }}
            >
              {oauthSubmitting ? "מעביר ל-Google..." : "המשך עם Google"}
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              כבר יש לך חשבון?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline"
              >
                התחבר
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Step 1 — credentials
// =============================================================================

function Step1({ form }: { form: UseFormReturn<SignupInput> }) {
  return (
    <>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>אימייל</FormLabel>
            <FormControl>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
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
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>סיסמה</FormLabel>
            <FormControl>
              <Input
                type="password"
                autoComplete="new-password"
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
        name="confirmPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>אישור סיסמה</FormLabel>
            <FormControl>
              <Input
                type="password"
                autoComplete="new-password"
                dir="ltr"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// =============================================================================
// Step 2 — personal details
// =============================================================================

function Step2({
  form,
  calendarOpen,
  setCalendarOpen,
}: {
  form: UseFormReturn<SignupInput>;
  calendarOpen: boolean;
  setCalendarOpen: (v: boolean) => void;
}) {
  const birthDateValue = useWatch({
    control: form.control,
    name: "birth_date",
  });
  const selectedDate = birthDateValue
    ? new Date(`${birthDateValue}T00:00:00Z`)
    : undefined;

  return (
    <>
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
              {/* TODO(slice-7): RadioGroupItem fires Base UI's "uncontrolled →
                  controlled value state" warning on first gender selection
                  even with value={field.value ?? ""} on the RadioGroup. The
                  warning originates inside each Radio.Root's internal
                  useControlled (see node_modules/@base-ui/utils/esm/useControlled.js).
                  Non-blocking — flow completes correctly. Resolution candidates:
                  pass an explicit defaultValue="" to RadioGroup, refactor to a
                  custom Radio that reads the group context's controlled value,
                  or upstream a Base UI fix. */}
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
            <FormControl>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCalendarOpen(!calendarOpen)}
                className={cn(
                  "w-full justify-between font-normal",
                  !field.value && "text-muted-foreground"
                )}
                aria-expanded={calendarOpen}
              >
                {field.value
                  ? new Date(`${field.value}T00:00:00Z`).toLocaleDateString(
                      "he-IL"
                    )
                  : "בחר תאריך לידה"}
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </FormControl>
            {calendarOpen && (
              <div className="mt-2 flex justify-center rounded-md border p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      // YYYY-MM-DD using UTC to match the Zod schema's compare.
                      const iso = date.toISOString().slice(0, 10);
                      field.onChange(iso);
                      void form.trigger("birth_date");
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(d) => d > maxBirthDate()}
                  captionLayout="dropdown"
                  startMonth={new Date(1940, 0)}
                  endMonth={maxBirthDate()}
                  defaultMonth={selectedDate ?? new Date(2000, 0)}
                  locale={he}
                />
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// =============================================================================
// Step 3 — exam date + terms
// =============================================================================

function Step3({
  form,
  examMonth,
  setExamMonth,
  examYear,
  setExamYear,
}: {
  form: UseFormReturn<SignupInput>;
  examMonth: string;
  setExamMonth: (v: string) => void;
  examYear: string;
  setExamYear: (v: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
  ];

  return (
    <>
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
                  {yearOptions.map((y) => (
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
    </>
  );
}

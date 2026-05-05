"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { he } from "date-fns/locale";
import { ChevronDownIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
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
import { cn } from "@/lib/utils";
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

/** Today − 18 years. Used by the Calendar's disabled matcher and as the
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

export default function CompleteProfileForm() {
  const [submitting, setSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Local mirrors for the month/year selects. Combined into a YYYY-MM-01
  // string and pushed into the form's exam_date_planned field when both
  // are set; null when either is empty.
  const [examMonth, setExamMonth] = useState<string>("");
  const [examYear, setExamYear] = useState<string>("");

  const defaultValues: DefaultValues<OAuthCompletionInput> = {
    phone: "",
    birth_date: "",
    exam_date_planned: null,
    // gender and terms_accepted intentionally undefined — user must select.
  };

  const form = useForm<OAuthCompletionInput>({
    resolver: zodResolver(oauthCompletionSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues,
  });

  // useWatch (rather than form.watch) so React Compiler can safely memoize.
  const termsAccepted = useWatch({
    control: form.control,
    name: "terms_accepted",
  });
  const birthDateValue = useWatch({
    control: form.control,
    name: "birth_date",
  });
  const selectedDate = birthDateValue
    ? new Date(`${birthDateValue}T00:00:00Z`)
    : undefined;

  // Sync month + year selects → exam_date_planned form field (YYYY-MM-01 or null).
  useEffect(() => {
    const value =
      examMonth && examYear ? `${examYear}-${examMonth}-01` : null;
    form.setValue("exam_date_planned", value, { shouldValidate: false });
  }, [examMonth, examYear, form]);

  async function onSubmit(values: OAuthCompletionInput) {
    setSubmitting(true);
    try {
      const result = await completeGoogleOAuthSignup(values);
      // Server Action redirects on success (throws NEXT_REDIRECT). The merge
      // guard inside the action also redirects /dashboard if a profile
      // already exists, throwing NEXT_REDIRECT — same code path here.
      if (result?.ok === false) {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      if (!isNextRedirect(err)) {
        toast.error("אירעה שגיאה. נסה שוב");
        setSubmitting(false);
      }
      // NEXT_REDIRECT: re-throw so Next handles the navigation.
      throw err;
    }
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">השלמת הרשמה</CardTitle>
        <CardDescription className="text-center">
          כדי להמשיך, נשלים כמה פרטים נוספים
        </CardDescription>
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
                            // YYYY-MM-DD using UTC to match the Zod schema's
                            // lexicographic 18+ compare.
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

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || termsAccepted !== true}
            >
              {submitting ? "שולח..." : "המשך"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

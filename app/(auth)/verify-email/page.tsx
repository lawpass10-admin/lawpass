import { Suspense } from "react";

import OtpForm from "./_components/otp-form";

export default function VerifyEmailPage() {
  // Suspense boundary required because OtpForm uses useSearchParams.
  return (
    <Suspense fallback={null}>
      <OtpForm />
    </Suspense>
  );
}

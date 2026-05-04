import { Suspense } from "react";

import ResetPasswordForm from "./_components/reset-password-form";

export default function ResetPasswordPage() {
  // Suspense boundary required because ResetPasswordForm uses useSearchParams.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

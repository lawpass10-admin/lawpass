import { Suspense } from "react";

import LoginForm from "./_components/login-form";

export default function LoginPage() {
  // Suspense boundary required because LoginForm uses useSearchParams.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

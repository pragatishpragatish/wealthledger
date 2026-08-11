import { AuthShell } from "@/features/auth/auth-shell";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata = { title: "Create account · WealthLedger" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Track net worth, loans, and investments in one place"
    >
      <SignupForm />
    </AuthShell>
  );
}

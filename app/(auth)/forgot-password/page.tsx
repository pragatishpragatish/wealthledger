import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata = { title: "Forgot password · WealthLedger" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="We'll email you a link to choose a new password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

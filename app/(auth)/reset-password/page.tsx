import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata = { title: "Set new password · WealthLedger" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Enter a strong password for your account"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

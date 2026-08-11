import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Sign in · WealthLedger" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;
  const deleted = params.deleted === "1";

  return (
    <AuthShell
      title={deleted ? "Account deleted" : "Welcome back"}
      description={
        deleted
          ? "Your account and all related data have been removed. You can create a new account anytime."
          : "Sign in to your personal finance dashboard"
      }
    >
      <LoginForm />
    </AuthShell>
  );
}

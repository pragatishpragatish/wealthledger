"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthResult, resetPassword } from "@/features/auth/actions";

const initial: AuthResult = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, initial);

  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="off"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="off"
          className="h-11"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}

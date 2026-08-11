"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthResult, signUpWithEmail, signInWithGoogle } from "@/features/auth/actions";

const initial: AuthResult = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpWithEmail, initial);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" autoComplete="off">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            name="full_name"
            placeholder="Your name"
            autoComplete="off"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="off"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="off"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters</p>
        </div>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {state.success}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <form action={signInWithGoogle} autoComplete="off">
        <Button type="submit" variant="outline" className="h-11 w-full">
          Continue with Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AuthResult,
  signInWithEmail,
  signInWithGoogle,
  signInWithMagicLink,
} from "@/features/auth/actions";

const initial: AuthResult = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithEmail, initial);
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    initial
  );

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" autoComplete="off">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="h-11"
          />
        </div>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <form action={signInWithGoogle} autoComplete="off">
        <Button type="submit" variant="outline" className="h-11 w-full">
          <GoogleIcon className="mr-2 size-4" />
          Continue with Google
        </Button>
      </form>

      <form action={magicAction} className="space-y-3 rounded-xl border bg-muted/40 p-4" autoComplete="off">
        <p className="text-sm font-medium">Magic link</p>
        <Input
          name="email"
          type="email"
          placeholder="Email for magic link"
          required
          className="h-10"
        />
        {magicState.error && (
          <p className="text-sm text-destructive">{magicState.error}</p>
        )}
        {magicState.success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {magicState.success}
          </p>
        )}
        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          disabled={magicPending}
        >
          {magicPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Send magic link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

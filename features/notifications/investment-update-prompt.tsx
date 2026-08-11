"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { LineChart, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markNotificationRead } from "@/features/notifications/queries";
import type { Notification } from "@/types";

function sessionKey(notification: Notification) {
  const q =
    typeof notification.metadata?.quarterKey === "string"
      ? notification.metadata.quarterKey
      : notification.id;
  return `wl-inv-update-prompt-${q}`;
}

export function InvestmentUpdatePrompt({
  notification,
}: {
  notification: Notification | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!notification || notification.is_read) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(sessionKey(notification))) {
        setOpen(false);
        return;
      }
    } catch {
      // ignore private mode / unavailable sessionStorage
    }
    setOpen(true);
  }, [notification]);

  function dismissForSession() {
    if (!notification) return;
    try {
      sessionStorage.setItem(sessionKey(notification), "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function markDone() {
    if (!notification) return;
    startTransition(async () => {
      await markNotificationRead(notification.id);
      dismissForSession();
    });
  }

  if (!notification) return null;

  const quarterLabel =
    typeof notification.metadata?.quarterKey === "string"
      ? String(notification.metadata.quarterKey).replace("-", " ")
      : "this quarter";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissForSession();
        else setOpen(true);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
            <LineChart className="size-5" />
          </div>
          <DialogTitle>Time to refresh investment values</DialogTitle>
          <DialogDescription className="text-left">
            Quarterly check-in for <strong>{quarterLabel}</strong>. Update
            current prices / NAVs on your holdings so portfolio value, gains, and
            net worth stay accurate for tax and planning.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Mutual funds &amp; stocks — latest NAV / market price</li>
          <li>FD / RD / bonds — accrued or current value</li>
          <li>Gold, crypto, and other assets — mark to market</li>
        </ul>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={dismissForSession}
            disabled={pending}
          >
            Remind me later
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={markDone}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            I&apos;ve updated
          </Button>
          <Link
            href="/investments"
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full sm:w-auto"
            )}
            onClick={markDone}
          >
            Update investments
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

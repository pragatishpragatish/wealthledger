"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ensureQuarterlyInvestmentReminder } from "@/features/notifications/quarterly-investment-reminder";
import type { Notification } from "@/types";

const InvestmentUpdatePrompt = dynamic(
  () =>
    import("@/features/notifications/investment-update-prompt").then((m) => ({
      default: m.InvestmentUpdatePrompt,
    })),
  { ssr: false }
);

/** Runs after first paint so login / navigation stay snappy. */
export function InvestmentReminderHost() {
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void ensureQuarterlyInvestmentReminder()
        .then((n) => {
          if (!cancelled) setNotification(n);
        })
        .catch(() => {
          /* non-blocking */
        });
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      const id = ric(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }

    const t = window.setTimeout(run, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!notification) return null;
  return <InvestmentUpdatePrompt notification={notification} />;
}

"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/queries";

export function NotificationsPanel({
  open,
  onOpenChange,
  unreadCount = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount?: number;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listNotifications()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load notifications");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked read");
    });
  }

  function handleMarkOne(id: string) {
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </SheetDescription>
            </div>
            {items.some((n) => !n.is_read) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAll}
                disabled={pending}
              >
                <CheckCheck className="size-4" />
                Mark all
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5.5rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Bell className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                EMI, card dues, budget alerts and quarterly investment reminders will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    !n.is_read && "bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {n.link && (
                          <Link
                            href={n.link}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "xs" })
                            )}
                            onClick={() => {
                              if (!n.is_read) handleMarkOne(n.id);
                              onOpenChange(false);
                            }}
                          >
                            Open
                          </Link>
                        )}
                        {!n.is_read && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleMarkOne(n.id)}
                            disabled={pending}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

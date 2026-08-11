"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Menu, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { Profile } from "@/types";

const GlobalSearch = dynamic(
  () =>
    import("@/features/search/global-search").then((m) => ({
      default: m.GlobalSearch,
    })),
  { ssr: false }
);

const NotificationsPanel = dynamic(
  () =>
    import("@/features/notifications/notifications-panel").then((m) => ({
      default: m.NotificationsPanel,
    })),
  { ssr: false }
);

export function Header({
  profile,
  unreadCount = 0,
}: {
  profile: Profile | null;
  unreadCount?: number;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="hidden flex-1 md:block">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
        >
          <Search className="size-4" />
          <span>Search accounts, transactions…</span>
          <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 md:hidden"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen(true)}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
          )}
        </Button>
        <ThemeToggle />
        <UserMenu profile={profile} />
      </div>

      {searchOpen ? (
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
      {notificationsOpen ? (
        <NotificationsPanel
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          unreadCount={unreadCount}
        />
      ) : null}
    </header>
  );
}

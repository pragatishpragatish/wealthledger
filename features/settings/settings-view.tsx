"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/page-header";
import type { Profile, Settings } from "@/types";
import {
  deleteAccount,
  exportUserData,
  importUserData,
  updateNotificationPrefs,
  updateProfile,
  updateTheme,
} from "@/features/settings/actions";

const NOTIFY_TOGGLES: {
  key: keyof Pick<
    Settings,
    | "notify_emi"
    | "notify_credit_card"
    | "notify_budget"
    | "notify_large_expense"
    | "notify_investment_maturity"
    | "notify_investment_update"
    | "notify_goal_milestones"
  >;
  label: string;
  description: string;
}[] = [
  {
    key: "notify_emi",
    label: "EMI reminders",
    description: "Upcoming loan EMI due dates",
  },
  {
    key: "notify_credit_card",
    label: "Credit card dues",
    description: "Statement and payment reminders",
  },
  {
    key: "notify_budget",
    label: "Budget alerts",
    description: "When spending nears category limits",
  },
  {
    key: "notify_large_expense",
    label: "Large expenses",
    description: "Transactions above your threshold",
  },
  {
    key: "notify_investment_maturity",
    label: "Investment maturity",
    description: "FD, RD and other maturity dates",
  },
  {
    key: "notify_investment_update",
    label: "Quarterly investment value update",
    description: "Reminder once each quarter to refresh current prices / NAVs",
  },
  {
    key: "notify_goal_milestones",
    label: "Goal milestones",
    description: "Progress checkpoints on savings goals",
  },
];

export function SettingsView({
  profile,
  settings,
}: {
  profile: Profile;
  settings: Settings;
}) {
  const { setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, startDelete] = useTransition();

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [theme, setThemeLocal] = useState(settings.theme);
  const [prefs, setPrefs] = useState({
    notify_emi: settings.notify_emi,
    notify_credit_card: settings.notify_credit_card,
    notify_budget: settings.notify_budget,
    notify_large_expense: settings.notify_large_expense,
    notify_investment_maturity: settings.notify_investment_maturity,
    notify_investment_update: settings.notify_investment_update ?? true,
    notify_goal_milestones: settings.notify_goal_milestones,
    large_expense_threshold: settings.large_expense_threshold,
  });

  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme, setTheme]);

  function handleSaveProfile() {
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        avatar_url: avatarUrl,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
    });
  }

  function handleThemeChange(value: string | null) {
    if (!value || (value !== "light" && value !== "dark" && value !== "system")) {
      return;
    }
    setThemeLocal(value);
    setTheme(value);
    startTransition(async () => {
      const result = await updateTheme(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Theme saved");
    });
  }

  function handleSaveNotifications() {
    startTransition(async () => {
      const result = await updateNotificationPrefs(prefs);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Notification preferences saved");
    });
  }

  function handleExport() {
    startTransition(async () => {
      const result = await exportUserData();
      if (result.error || !result.data) {
        toast.error(result.error ?? "Export failed");
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wealthledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    });
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const result = await importUserData(parsed);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          const count =
            typeof result.data === "object" &&
            result.data &&
            "imported" in result.data
              ? Number((result.data as { imported: number }).imported)
              : 0;
          toast.success(`Imported ${count} records`);
        } catch {
          toast.error("Could not parse JSON file");
        }
      });
    };
    reader.readAsText(file);
  }

  function handleDeleteAccount() {
    startDelete(async () => {
      const result = await deleteAccount(deleteConfirm);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Profile, theme, notifications, backup/restore, and account."
      />

      <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Update your display name, phone and avatar URL.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.email} disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <Button onClick={handleSaveProfile} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save profile
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold">Theme</h2>
          <p className="text-sm text-muted-foreground">
            Choose light, dark, or follow system preference.
          </p>
        </div>
        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Notification preferences
          </h2>
          <p className="text-sm text-muted-foreground">
            Control which reminders WealthLedger can surface.
          </p>
        </div>
        <div className="space-y-4">
          {NOTIFY_TOGGLES.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Switch
                checked={prefs[item.key]}
                onCheckedChange={(checked) =>
                  setPrefs((prev) => ({
                    ...prev,
                    [item.key]: checked === true,
                  }))
                }
              />
            </div>
          ))}
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="large_expense_threshold">
              Large expense threshold (₹)
            </Label>
            <Input
              id="large_expense_threshold"
              type="number"
              min={0}
              step={100}
              className="max-w-xs"
              value={prefs.large_expense_threshold}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  large_expense_threshold: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>
        <Button onClick={handleSaveNotifications} disabled={pending}>
          Save preferences
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Backup & restore
          </h2>
          <p className="text-sm text-muted-foreground">
            Download all financial data as JSON, or import a previous backup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={pending}>
            <Download className="size-4" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <Upload className="size-4" />
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your WealthLedger account, login, and every
            related record (accounts, transactions, loans, investments, and
            more). This cannot be undone — export a backup first if you need
            it.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setDeleteConfirm("");
            setDeleteOpen(true);
          }}
          disabled={pending || deleting}
        >
          <Trash2 className="size-4" />
          Delete account
        </Button>
      </section>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteConfirm("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your auth user and all finance data from the
              database. Type <span className="font-semibold text-foreground">DELETE</span>{" "}
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <Label htmlFor="delete_confirm">Confirmation</Label>
            <Input
              id="delete_confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting || deleteConfirm.trim() !== "DELETE"}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

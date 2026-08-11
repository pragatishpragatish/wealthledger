import Link from "next/link";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-background to-background dark:from-teal-400/8"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-teal-600/10 blur-3xl dark:bg-teal-500/15"
      />

      <div className="relative z-10 mb-8 text-center">
        <Link href="/login" className="inline-flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-teal-700 text-sm font-semibold text-white shadow-lg shadow-teal-700/25 dark:bg-teal-500 dark:text-teal-950">
            W
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight">
            WealthLedger
          </span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-8 dark:shadow-black/30">
        <div className="mb-6 space-y-1.5 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

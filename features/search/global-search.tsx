"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Landmark,
  PiggyBank,
  Target,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SearchHit } from "@/features/search/types";

const TYPE_META: Record<
  SearchHit["type"],
  { label: string; icon: typeof Wallet }
> = {
  account: { label: "Accounts", icon: Landmark },
  transaction: { label: "Transactions", icon: ArrowLeftRight },
  investment: { label: "Investments", icon: PiggyBank },
  loan: { label: "Loans", icon: Wallet },
  credit_card: { label: "Credit cards", icon: CreditCard },
  goal: { label: "Goals", icon: Target },
};

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = (await res.json()) as { results: SearchHit[] };
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const handle = window.setTimeout(() => runSearch(query), 200);
    return () => window.clearTimeout(handle);
  }, [query, runSearch]);

  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    const key = hit.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(hit);
    return acc;
  }, {});

  function selectHit(hit: SearchHit) {
    onOpenChange(false);
    router.push(hit.href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global search"
      description="Search accounts, transactions, investments, loans, cards and goals"
      className="sm:max-w-lg"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search accounts, transactions…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2
              ? "Type at least 2 characters"
              : pending
                ? "Searching…"
                : "No results found"}
          </CommandEmpty>
          {Object.entries(grouped).map(([type, hits]) => {
            const meta = TYPE_META[type as SearchHit["type"]];
            const Icon = meta.icon;
            return (
              <CommandGroup key={type} heading={meta.label}>
                {hits.map((hit) => (
                  <CommandItem
                    key={`${hit.type}-${hit.id}`}
                    value={`${hit.type}-${hit.id}-${hit.title}`}
                    onSelect={() => selectHit(hit)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{hit.title}</p>
                      {hit.subtitle && (
                        <p className="truncate text-xs text-muted-foreground">
                          {hit.subtitle}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

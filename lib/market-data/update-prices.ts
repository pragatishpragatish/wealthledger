import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvestmentType } from "@/types";
import {
  fetchMfapiNav,
  fetchYahooPrice,
  isQuoteError,
  type QuoteError,
  type QuoteResult,
} from "@/lib/market-data/quotes";

export type PriceUpdateTarget = {
  id: string;
  user_id: string;
  name: string;
  type: InvestmentType;
  symbol: string | null;
  units: number;
  current_price: number;
  current_value: number;
};

export type PriceUpdateOutcome = {
  id: string;
  name: string;
  symbol: string;
  ok: boolean;
  price?: number;
  previousPrice?: number;
  error?: string;
  source?: "yahoo" | "mfapi";
};

/** Types that can be auto-priced when a symbol/scheme code is set. */
export function canAutoPrice(type: InvestmentType): boolean {
  return (
    type === "stocks" ||
    type === "etf" ||
    type === "mutual_funds" ||
    type === "crypto"
  );
}

export function quoteProviderForType(
  type: InvestmentType
): "yahoo" | "mfapi" | null {
  if (type === "mutual_funds") return "mfapi";
  if (type === "stocks" || type === "etf" || type === "crypto") return "yahoo";
  return null;
}

export function symbolFieldHint(type: InvestmentType): string {
  if (type === "mutual_funds") {
    return "AMFI scheme code (e.g. 125497). Find it on mfapi.in or AMFI.";
  }
  if (type === "crypto") {
    return "Yahoo symbol (e.g. BTC-INR or BTC-USD)";
  }
  if (type === "stocks" || type === "etf") {
    return "Yahoo ticker — NSE: RELIANCE.NS · BSE: RELIANCE.BO";
  }
  return "Optional quote symbol";
}

async function fetchQuote(
  type: InvestmentType,
  symbol: string
): Promise<QuoteResult | QuoteError> {
  const provider = quoteProviderForType(type);
  if (provider === "mfapi") return fetchMfapiNav(symbol);
  if (provider === "yahoo") return fetchYahooPrice(symbol);
  return { symbol, error: "Type does not support auto pricing", source: "yahoo" };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Update current_price / current_value for holdings that have a symbol.
 * Pass a user-scoped or service-role Supabase client.
 */
export async function updateInvestmentPrices(
  supabase: SupabaseClient,
  opts?: { userId?: string; ids?: string[] }
): Promise<{
  updated: number;
  failed: number;
  skipped: number;
  results: PriceUpdateOutcome[];
}> {
  let query = supabase
    .from("investments")
    .select(
      "id, user_id, name, type, symbol, units, current_price, current_value"
    )
    .eq("is_active", true)
    .not("symbol", "is", null);

  if (opts?.userId) query = query.eq("user_id", opts.userId);
  if (opts?.ids?.length) query = query.in("id", opts.ids);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PriceUpdateTarget[];
  const results: PriceUpdateOutcome[] = [];
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const symbol = row.symbol?.trim() ?? "";
    if (!symbol || !canAutoPrice(row.type)) {
      skipped += 1;
      results.push({
        id: row.id,
        name: row.name,
        symbol,
        ok: false,
        error: !symbol ? "No symbol" : "Type not auto-priced",
      });
      continue;
    }

    const quote = await fetchQuote(row.type, symbol);
    // Be polite to free APIs
    await sleep(120);

    if (isQuoteError(quote)) {
      failed += 1;
      results.push({
        id: row.id,
        name: row.name,
        symbol,
        ok: false,
        error: quote.error,
        source: quote.source,
      });
      continue;
    }

    const units = Number(row.units) || 0;
    const nextValue =
      units > 0
        ? Math.round(units * quote.price * 100) / 100
        : Math.round(Number(row.current_value) || quote.price);

    const { error: updateError } = await supabase
      .from("investments")
      .update({
        current_price: quote.price,
        current_value: nextValue,
        last_priced_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      failed += 1;
      results.push({
        id: row.id,
        name: row.name,
        symbol,
        ok: false,
        error: updateError.message,
        source: quote.source,
      });
      continue;
    }

    updated += 1;
    results.push({
      id: row.id,
      name: row.name,
      symbol,
      ok: true,
      price: quote.price,
      previousPrice: Number(row.current_price) || 0,
      source: quote.source,
    });
  }

  return { updated, failed, skipped, results };
}

export type QuoteResult = {
  symbol: string;
  price: number;
  currency?: string;
  asOf?: string;
  source: "yahoo" | "mfapi";
};

export type QuoteError = {
  symbol: string;
  error: string;
  source: "yahoo" | "mfapi";
};

/** Yahoo chart endpoint — unofficial, no API key. */
export async function fetchYahooPrice(
  symbol: string
): Promise<QuoteResult | QuoteError> {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    return { symbol, error: "Empty symbol", source: "yahoo" };
  }

  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(trimmed)}`
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "5d");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "WealthLedger/1.0 (personal finance)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return {
        symbol: trimmed,
        error: `Yahoo HTTP ${res.status}`,
        source: "yahoo",
      };
    }

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            currency?: string;
            symbol?: string;
          };
          indicators?: {
            quote?: Array<{ close?: Array<number | null> }>;
          };
        }>;
        error?: { description?: string };
      };
    };

    if (json.chart?.error?.description) {
      return {
        symbol: trimmed,
        error: json.chart.error.description,
        source: "yahoo",
      };
    }

    const result = json.chart?.result?.[0];
    const metaPrice = result?.meta?.regularMarketPrice;
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const lastClose = [...closes].reverse().find((c) => c != null && c > 0);

    const price = Number(metaPrice ?? lastClose);
    if (!Number.isFinite(price) || price <= 0) {
      return {
        symbol: trimmed,
        error: "No price in Yahoo response",
        source: "yahoo",
      };
    }

    return {
      symbol: trimmed,
      price: Math.round(price * 10000) / 10000,
      currency: result?.meta?.currency,
      source: "yahoo",
    };
  } catch (e) {
    return {
      symbol: trimmed,
      error: e instanceof Error ? e.message : "Yahoo fetch failed",
      source: "yahoo",
    };
  }
}

/** Indian mutual fund latest NAV via MFAPI (AMFI scheme code). */
export async function fetchMfapiNav(
  schemeCode: string
): Promise<QuoteResult | QuoteError> {
  const code = schemeCode.trim();
  if (!/^\d+$/.test(code)) {
    return {
      symbol: schemeCode,
      error: "Scheme code must be numeric (AMFI)",
      source: "mfapi",
    };
  }

  try {
    const res = await fetch(`https://api.mfapi.in/mf/${code}/latest`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return {
        symbol: code,
        error: `MFAPI HTTP ${res.status}`,
        source: "mfapi",
      };
    }

    const json = (await res.json()) as {
      status?: string;
      data?: Array<{ date?: string; nav?: string }>;
      meta?: { scheme_name?: string };
    };

    if (json.status && json.status !== "SUCCESS") {
      return {
        symbol: code,
        error: `MFAPI status ${json.status}`,
        source: "mfapi",
      };
    }

    const navStr = json.data?.[0]?.nav;
    const price = Number(navStr);
    if (!Number.isFinite(price) || price <= 0) {
      return {
        symbol: code,
        error: "No NAV in MFAPI response",
        source: "mfapi",
      };
    }

    return {
      symbol: code,
      price: Math.round(price * 10000) / 10000,
      asOf: json.data?.[0]?.date,
      currency: "INR",
      source: "mfapi",
    };
  } catch (e) {
    return {
      symbol: code,
      error: e instanceof Error ? e.message : "MFAPI fetch failed",
      source: "mfapi",
    };
  }
}

export function isQuoteError(
  r: QuoteResult | QuoteError
): r is QuoteError {
  return "error" in r;
}

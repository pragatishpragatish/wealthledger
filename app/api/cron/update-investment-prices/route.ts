import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateInvestmentPrices } from "@/lib/market-data/update-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Vercel Cron sends this header when CRON_SECRET is configured
  const cronHeader = req.headers.get("x-vercel-cron");
  if (cronHeader && process.env.VERCEL === "1") {
    // Prefer Authorization; allow cron header only with matching query token as fallback
    const url = new URL(req.url);
    if (url.searchParams.get("secret") === secret) return true;
  }
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await updateInvestmentPrices(supabase);
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      failed: result.failed,
      skipped: result.skipped,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Price update failed",
      },
      { status: 500 }
    );
  }
}

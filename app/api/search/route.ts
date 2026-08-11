import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SearchHit } from "@/features/search/types";

export type { SearchHit };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] as SearchHit[] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safe = q.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
  if (safe.length < 2) {
    return NextResponse.json({ results: [] as SearchHit[] });
  }
  const pattern = `%${safe}%`;

  const [
    accountsRes,
    transactionsRes,
    investmentsRes,
    loansRes,
    cardsRes,
    goalsRes,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank_name")
      .eq("user_id", user.id)
      .or(`name.ilike."${pattern}",bank_name.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from("transactions")
      .select("id, type, amount, merchant, notes, date")
      .eq("user_id", user.id)
      .or(`merchant.ilike."${pattern}",notes.ilike."${pattern}"`)
      .order("date", { ascending: false })
      .limit(8),
    supabase
      .from("investments")
      .select("id, name, type, platform")
      .eq("user_id", user.id)
      .or(`name.ilike."${pattern}",platform.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from("loans")
      .select("id, name, bank, loan_type")
      .eq("user_id", user.id)
      .or(`name.ilike."${pattern}",bank.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from("credit_cards")
      .select("id, bank, card_name, last_four")
      .eq("user_id", user.id)
      .or(`bank.ilike."${pattern}",card_name.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from("goals")
      .select("id, name, type")
      .eq("user_id", user.id)
      .ilike("name", pattern)
      .limit(8),
  ]);

  const results: SearchHit[] = [];

  for (const a of accountsRes.data ?? []) {
    results.push({
      id: a.id,
      type: "account",
      title: a.name,
      subtitle: a.bank_name,
      href: "/accounts",
    });
  }

  for (const t of transactionsRes.data ?? []) {
    results.push({
      id: t.id,
      type: "transaction",
      title: t.merchant || t.notes || t.type,
      subtitle: `${t.type} · ${t.date} · ₹${Number(t.amount).toLocaleString("en-IN")}`,
      href: "/transactions",
    });
  }

  for (const i of investmentsRes.data ?? []) {
    results.push({
      id: i.id,
      type: "investment",
      title: i.name,
      subtitle: [i.type?.replaceAll("_", " "), i.platform]
        .filter(Boolean)
        .join(" · "),
      href: "/investments",
    });
  }

  for (const l of loansRes.data ?? []) {
    results.push({
      id: l.id,
      type: "loan",
      title: l.name,
      subtitle: `${l.bank} · ${l.loan_type?.replaceAll("_", " ")}`,
      href: "/loans",
    });
  }

  for (const c of cardsRes.data ?? []) {
    results.push({
      id: c.id,
      type: "credit_card",
      title: `${c.bank} ${c.card_name}`,
      subtitle: c.last_four ? `•••• ${c.last_four}` : undefined,
      href: "/credit-cards",
    });
  }

  for (const g of goalsRes.data ?? []) {
    results.push({
      id: g.id,
      type: "goal",
      title: g.name,
      subtitle: g.type?.replaceAll("_", " "),
      href: "/goals",
    });
  }

  return NextResponse.json({ results });
}

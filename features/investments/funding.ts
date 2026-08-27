import type { Account, AccountType, InvestmentType } from "@/types";

/** Stocks & ETFs are funded from broker wallets; MF/bonds/etc. from bank accounts. */
export function investmentFundingKind(
  type: InvestmentType
): "broker" | "bank" {
  if (type === "stocks" || type === "etf") return "broker";
  return "bank";
}

export function isBrokerAccount(account: Pick<Account, "account_type">) {
  return account.account_type === "broker_wallet";
}

export function filterFundingAccounts(
  accounts: Array<
    Pick<Account, "id" | "name" | "bank_name" | "current_balance" | "account_type">
  >,
  kind: "broker" | "bank"
) {
  return accounts.filter((a) =>
    kind === "broker" ? isBrokerAccount(a) : !isBrokerAccount(a)
  );
}

export function fundingHint(kind: "broker" | "bank") {
  return kind === "broker"
    ? "Stocks & ETFs debit your stock broker wallet. Fund the wallet via Transfers from a bank first."
    : "Mutual funds, bonds and deposits debit a bank / cash account.";
}

export function matchBrokerWalletByPlatform(
  accounts: Array<
    Pick<Account, "id" | "name" | "bank_name" | "account_type">
  >,
  platform: string | null | undefined
) {
  if (!platform?.trim()) return null;
  const needle = platform.trim().toLowerCase();
  return (
    accounts.find(
      (a) =>
        a.account_type === ("broker_wallet" as AccountType) &&
        a.bank_name.toLowerCase() === needle
    ) ??
    accounts.find(
      (a) =>
        a.account_type === ("broker_wallet" as AccountType) &&
        a.bank_name.toLowerCase().includes(needle)
    ) ??
    null
  );
}

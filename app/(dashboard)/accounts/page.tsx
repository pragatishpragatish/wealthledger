import { AccountsView } from "@/features/accounts/accounts-view";
import {
  getAccounts,
  getAccountsSummary,
} from "@/features/accounts/queries";

export const metadata = { title: "Bank Accounts · WealthLedger" };

export default async function AccountsPage() {
  const [accounts, summary] = await Promise.all([
    getAccounts(),
    getAccountsSummary(),
  ]);

  return <AccountsView accounts={accounts} summary={summary} />;
}

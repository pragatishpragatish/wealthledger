import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Wallet,
  CreditCard,
  LineChart,
  HandCoins,
  PiggyBank,
  Target,
  CalendarDays,
  FileBarChart,
  Calculator,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Accounts", href: "/accounts", icon: Landmark },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Income", href: "/income", icon: TrendingUp },
  { title: "Expenses", href: "/expenses", icon: Wallet },
  { title: "Credit Cards", href: "/credit-cards", icon: CreditCard },
  { title: "Investments", href: "/investments", icon: LineChart },
  { title: "Loans", href: "/loans", icon: HandCoins },
  { title: "Budgets", href: "/budgets", icon: PiggyBank },
  { title: "Net Worth", href: "/net-worth", icon: LineChart },
  { title: "Goals", href: "/goals", icon: Target },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Reports", href: "/reports", icon: FileBarChart },
  { title: "Calculators", href: "/calculator", icon: Calculator },
];

export const bottomNav: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

/**
 * Shared constants for finance domain enums / labels.
 */

export const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "salary", label: "Salary" },
  { value: "current", label: "Current" },
  { value: "cash_wallet", label: "Cash Wallet" },
  { value: "upi_wallet", label: "UPI Wallet" },
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Rental",
  "Interest",
  "Dividend",
  "Trading Returns",
  "Stock Returns",
  "Cashback",
  "Gifts",
  "Others",
] as const;

export const EXPENSE_CATEGORIES = [
  "Food",
  "Groceries",
  "Fuel",
  "Shopping",
  "Subscriptions",
  "Gym",
  "Medical",
  "Travel",
  "Entertainment",
  "Utilities",
  "Education",
  "Insurance",
  "EMI",
  "Investment",
  "Rent",
  "Tax",
  "Misc",
] as const;

export const INVESTMENT_TYPES = [
  { value: "stocks", label: "Stocks" },
  { value: "mutual_funds", label: "Mutual Funds" },
  { value: "etf", label: "ETF" },
  { value: "fd", label: "FD" },
  { value: "rd", label: "RD" },
  { value: "ppf", label: "PPF" },
  { value: "epf", label: "EPF" },
  { value: "nps", label: "NPS" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "crypto", label: "Crypto" },
  { value: "bonds", label: "Bonds" },
  { value: "real_estate", label: "Real Estate" },
] as const;

/** Quick-start presets for the Add Investment form */
export const INVESTMENT_ENTRY_PRESETS = [
  {
    id: "mutual_funds",
    label: "Mutual fund",
    description: "Add now, top up later with dated entries",
    type: "mutual_funds" as const,
  },
  {
    id: "stocks",
    label: "Stocks",
    description: "Shares & equity",
    type: "stocks" as const,
  },
  {
    id: "etf",
    label: "ETF",
    description: "Index / sector ETFs",
    type: "etf" as const,
  },
  {
    id: "fd",
    label: "FD / RD",
    description: "Fixed or recurring deposit",
    type: "fd" as const,
  },
  {
    id: "retirement",
    label: "PPF / EPF / NPS",
    description: "Retirement accounts",
    type: "ppf" as const,
  },
  {
    id: "gold",
    label: "Gold / Silver",
    description: "Bullion or digital metal",
    type: "gold" as const,
  },
  {
    id: "crypto",
    label: "Crypto",
    description: "Coins & tokens",
    type: "crypto" as const,
  },
  {
    id: "other",
    label: "Other",
    description: "Bonds, property, etc.",
    type: "bonds" as const,
  },
] as const;

export const INVESTMENT_PLATFORMS = [
  "Groww",
  "Zerodha",
  "Zerodha Coin",
  "MF Central",
  "Kuvera",
  "Paytm Money",
  "HDFC Bank",
  "SBI",
  "ICICI Direct",
  "Angel One",
  "Other",
] as const;

export const LOAN_TYPES = [
  { value: "home", label: "Home" },
  { value: "car", label: "Car" },
  { value: "education", label: "Education" },
  { value: "personal", label: "Personal" },
  { value: "gold", label: "Gold" },
  { value: "business", label: "Business" },
  { value: "credit_line", label: "Credit Line" },
] as const;

export const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "netbanking", label: "Net Banking" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "auto_debit", label: "Auto Debit" },
  { value: "other", label: "Other" },
] as const;

export const RECURRING_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

export const CREDIT_CARD_REWARD_TYPES = [
  { value: "cashback", label: "Cashback" },
  { value: "points", label: "Points" },
  { value: "miles", label: "Miles" },
  { value: "none", label: "None" },
] as const;

export const GOAL_TYPES = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "vacation", label: "Vacation" },
  { value: "car", label: "Car" },
  { value: "house", label: "House" },
  { value: "wedding", label: "Wedding" },
  { value: "education", label: "Education" },
  { value: "retirement", label: "Retirement" },
  { value: "custom", label: "Custom" },
] as const;

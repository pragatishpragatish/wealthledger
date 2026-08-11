-- ============================================================
-- WealthLedger – Personal Finance Dashboard
-- Migration 001: Core schema, indexes, constraints, RLS
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_type AS ENUM (
  'savings',
  'salary',
  'current',
  'cash_wallet',
  'upi_wallet'
);

CREATE TYPE transaction_type AS ENUM (
  'income',
  'expense',
  'transfer',
  'adjustment'
);

CREATE TYPE payment_method AS ENUM (
  'upi',
  'card',
  'netbanking',
  'cash',
  'cheque',
  'auto_debit',
  'other'
);

CREATE TYPE category_kind AS ENUM (
  'income',
  'expense'
);

CREATE TYPE credit_card_reward_type AS ENUM (
  'cashback',
  'points',
  'miles',
  'none'
);

CREATE TYPE investment_type AS ENUM (
  'stocks',
  'mutual_funds',
  'etf',
  'fd',
  'rd',
  'ppf',
  'epf',
  'nps',
  'gold',
  'silver',
  'crypto',
  'bonds',
  'real_estate'
);

CREATE TYPE loan_type AS ENUM (
  'home',
  'car',
  'education',
  'personal',
  'gold',
  'business',
  'credit_line'
);

CREATE TYPE interest_type AS ENUM (
  'reducing',
  'flat'
);

CREATE TYPE loan_input_mode AS ENUM (
  'tenure',
  'emi'
);

CREATE TYPE prepayment_strategy AS ENUM (
  'reduce_emi',
  'reduce_tenure'
);

CREATE TYPE budget_period AS ENUM (
  'monthly',
  'yearly'
);

CREATE TYPE goal_type AS ENUM (
  'emergency_fund',
  'vacation',
  'car',
  'house',
  'wedding',
  'education',
  'retirement',
  'custom'
);

CREATE TYPE notification_type AS ENUM (
  'emi_due',
  'credit_card_due',
  'budget_limit',
  'large_expense',
  'investment_maturity',
  'goal_milestone',
  'bill_due',
  'sip_due',
  'fd_maturity',
  'general'
);

CREATE TYPE recurring_frequency AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  locale TEXT NOT NULL DEFAULT 'en-IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind category_kind NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_name_kind_user_unique UNIQUE NULLS NOT DISTINCT (user_id, name, kind, parent_id)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_kind ON categories(kind);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user_id ON tags(user_id);

-- ============================================================
-- ACCOUNTS (Bank / Cash / UPI)
-- ============================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  ifsc TEXT,
  account_type account_type NOT NULL DEFAULT 'savings',
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0 OR account_type IN ('cash_wallet', 'upi_wallet')),
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_bank_name ON accounts(user_id, bank_name);
CREATE INDEX idx_accounts_is_active ON accounts(user_id, is_active);

-- ============================================================
-- TRANSACTIONS (Unified engine)
-- ============================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  merchant TEXT,
  notes TEXT,
  payment_method payment_method,
  receipt_url TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency recurring_frequency,
  credit_card_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_transfer_accounts CHECK (
    (type <> 'transfer') OR (account_id IS NOT NULL AND to_account_id IS NOT NULL AND account_id <> to_account_id)
  )
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_merchant ON transactions(user_id, merchant);

CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ============================================================
-- CREDIT CARDS
-- ============================================================

CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank TEXT NOT NULL,
  card_name TEXT NOT NULL,
  last_four TEXT,
  credit_limit NUMERIC(15, 2) NOT NULL CHECK (credit_limit > 0),
  outstanding NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
  statement_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  minimum_due NUMERIC(15, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  billing_date INT NOT NULL CHECK (billing_date BETWEEN 1 AND 28),
  due_date INT NOT NULL CHECK (due_date BETWEEN 1 AND 28),
  interest_rate NUMERIC(6, 3) NOT NULL DEFAULT 0,
  reward_type credit_card_reward_type NOT NULL DEFAULT 'none',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);

ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_credit_card
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL;

CREATE TABLE credit_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  merchant TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_payment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cc_tx_user_id ON credit_card_transactions(user_id);
CREATE INDEX idx_cc_tx_card_id ON credit_card_transactions(credit_card_id);

-- ============================================================
-- LOANS
-- ============================================================

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  loan_type loan_type NOT NULL,
  principal NUMERIC(15, 2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(6, 3) NOT NULL CHECK (interest_rate >= 0),
  interest_type interest_type NOT NULL DEFAULT 'reducing',
  input_mode loan_input_mode NOT NULL DEFAULT 'tenure',
  tenure_months INT NOT NULL CHECK (tenure_months > 0),
  emi NUMERIC(15, 2) NOT NULL CHECK (emi > 0),
  start_date DATE NOT NULL,
  processing_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  insurance_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  prepayment_charges NUMERIC(6, 3) NOT NULL DEFAULT 0,
  outstanding_principal NUMERIC(15, 2) NOT NULL,
  principal_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  emis_paid INT NOT NULL DEFAULT 0,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  document_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_is_active ON loans(user_id, is_active);

CREATE TABLE loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  emi_number INT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  principal_component NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest_component NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_prepayment BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user_id ON loan_payments(user_id);

CREATE TABLE loan_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Scenario',
  strategy prepayment_strategy NOT NULL DEFAULT 'reduce_tenure',
  one_time_amount NUMERIC(15, 2) DEFAULT 0,
  one_time_date DATE,
  recurring_extra_emi NUMERIC(15, 2) DEFAULT 0,
  increased_emi NUMERIC(15, 2),
  annual_lump_sum NUMERIC(15, 2) DEFAULT 0,
  original_emi NUMERIC(15, 2) NOT NULL,
  new_emi NUMERIC(15, 2) NOT NULL,
  original_tenure INT NOT NULL,
  new_tenure INT NOT NULL,
  interest_saved NUMERIC(15, 2) NOT NULL DEFAULT 0,
  months_saved INT NOT NULL DEFAULT 0,
  total_savings NUMERIC(15, 2) NOT NULL DEFAULT 0,
  schedule_json JSONB,
  is_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_simulations_loan_id ON loan_simulations(loan_id);

-- ============================================================
-- INVESTMENTS
-- ============================================================

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type investment_type NOT NULL,
  platform TEXT,
  purchase_date DATE,
  units NUMERIC(18, 6) DEFAULT 0,
  buy_price NUMERIC(15, 4) DEFAULT 0,
  current_price NUMERIC(15, 4) DEFAULT 0,
  invested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  current_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  maturity_date DATE,
  interest_rate NUMERIC(6, 3),
  document_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_type ON investments(user_id, type);

CREATE TABLE investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'interest', 'sip')),
  units NUMERIC(18, 6) DEFAULT 0,
  price NUMERIC(15, 4) DEFAULT 0,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_tx_investment_id ON investment_transactions(investment_id);

-- ============================================================
-- BUDGETS
-- ============================================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  period budget_period NOT NULL DEFAULT 'monthly',
  year INT NOT NULL CHECK (year >= 2000),
  month INT CHECK (month IS NULL OR (month BETWEEN 1 AND 12)),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  spent NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_period_month CHECK (
    (period = 'monthly' AND month IS NOT NULL) OR (period = 'yearly' AND month IS NULL)
  ),
  CONSTRAINT budgets_unique UNIQUE NULLS NOT DISTINCT (user_id, category_id, period, year, month)
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_period ON budgets(user_id, period, year, month);

-- ============================================================
-- GOALS
-- ============================================================

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type goal_type NOT NULL DEFAULT 'custom',
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  monthly_contribution NUMERIC(15, 2) NOT NULL DEFAULT 0,
  target_date DATE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  icon TEXT,
  color TEXT,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);

-- ============================================================
-- NET WORTH SNAPSHOTS
-- ============================================================

CREATE TABLE net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_investments NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_assets NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(15, 2) NOT NULL DEFAULT 0,
  credit_card_outstanding NUMERIC(15, 2) NOT NULL DEFAULT 0,
  loan_outstanding NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT net_worth_snapshots_user_date UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_net_worth_user_date ON net_worth_snapshots(user_id, snapshot_date DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- SETTINGS
-- ============================================================

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notify_emi BOOLEAN NOT NULL DEFAULT TRUE,
  notify_credit_card BOOLEAN NOT NULL DEFAULT TRUE,
  notify_budget BOOLEAN NOT NULL DEFAULT TRUE,
  notify_large_expense BOOLEAN NOT NULL DEFAULT TRUE,
  notify_investment_maturity BOOLEAN NOT NULL DEFAULT TRUE,
  notify_goal_milestones BOOLEAN NOT NULL DEFAULT TRUE,
  large_expense_threshold NUMERIC(15, 2) NOT NULL DEFAULT 10000,
  fiscal_year_start_month INT NOT NULL DEFAULT 4 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REPORTS (cached / generated)
-- ============================================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_user_id ON reports(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_credit_cards_updated_at BEFORE UPDATE ON credit_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loan_simulations_updated_at BEFORE UPDATE ON loan_simulations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_investments_updated_at BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PROFILE BOOTSTRAP ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.settings (user_id) VALUES (NEW.id);

  -- Seed system income categories for the user
  INSERT INTO public.categories (user_id, name, kind, icon, color, is_system, sort_order) VALUES
    (NEW.id, 'Salary', 'income', 'briefcase', '#0F766E', TRUE, 1),
    (NEW.id, 'Freelance', 'income', 'laptop', '#0891B2', TRUE, 2),
    (NEW.id, 'Business', 'income', 'building-2', '#2563EB', TRUE, 3),
    (NEW.id, 'Rental', 'income', 'home', '#7C3AED', TRUE, 4),
    (NEW.id, 'Interest', 'income', 'percent', '#CA8A04', TRUE, 5),
    (NEW.id, 'Dividend', 'income', 'pie-chart', '#16A34A', TRUE, 6),
    (NEW.id, 'Cashback', 'income', 'gift', '#DB2777', TRUE, 7),
    (NEW.id, 'Gifts', 'income', 'heart', '#E11D48', TRUE, 8),
    (NEW.id, 'Others', 'income', 'ellipsis', '#64748B', TRUE, 9);

  -- Seed system expense categories
  INSERT INTO public.categories (user_id, name, kind, icon, color, is_system, sort_order) VALUES
    (NEW.id, 'Food', 'expense', 'utensils', '#EA580C', TRUE, 1),
    (NEW.id, 'Groceries', 'expense', 'shopping-cart', '#16A34A', TRUE, 2),
    (NEW.id, 'Fuel', 'expense', 'fuel', '#CA8A04', TRUE, 3),
    (NEW.id, 'Shopping', 'expense', 'shopping-bag', '#DB2777', TRUE, 4),
    (NEW.id, 'Medical', 'expense', 'heart-pulse', '#DC2626', TRUE, 5),
    (NEW.id, 'Travel', 'expense', 'plane', '#2563EB', TRUE, 6),
    (NEW.id, 'Entertainment', 'expense', 'clapperboard', '#7C3AED', TRUE, 7),
    (NEW.id, 'Utilities', 'expense', 'zap', '#0891B2', TRUE, 8),
    (NEW.id, 'Education', 'expense', 'graduation-cap', '#4F46E5', TRUE, 9),
    (NEW.id, 'Insurance', 'expense', 'shield', '#0F766E', TRUE, 10),
    (NEW.id, 'EMI', 'expense', 'credit-card', '#B45309', TRUE, 11),
    (NEW.id, 'Investment', 'expense', 'trending-up', '#15803D', TRUE, 12),
    (NEW.id, 'Rent', 'expense', 'building', '#475569', TRUE, 13),
    (NEW.id, 'Tax', 'expense', 'receipt', '#991B1B', TRUE, 14),
    (NEW.id, 'Misc', 'expense', 'ellipsis', '#64748B', TRUE, 15);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Tags
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- Accounts
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Transaction tags
CREATE POLICY "Users can view own transaction_tags" ON transaction_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can insert own transaction_tags" ON transaction_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can delete own transaction_tags" ON transaction_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));

-- Credit cards
CREATE POLICY "Users can view own credit_cards" ON credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credit_cards" ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credit_cards" ON credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own credit_cards" ON credit_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cc_transactions" ON credit_card_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cc_transactions" ON credit_card_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cc_transactions" ON credit_card_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cc_transactions" ON credit_card_transactions FOR DELETE USING (auth.uid() = user_id);

-- Loans
CREATE POLICY "Users can view own loans" ON loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans" ON loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans" ON loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans" ON loans FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own loan_payments" ON loan_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loan_payments" ON loan_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loan_payments" ON loan_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loan_payments" ON loan_payments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own loan_simulations" ON loan_simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loan_simulations" ON loan_simulations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loan_simulations" ON loan_simulations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loan_simulations" ON loan_simulations FOR DELETE USING (auth.uid() = user_id);

-- Investments
CREATE POLICY "Users can view own investments" ON investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON investments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own inv_transactions" ON investment_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inv_transactions" ON investment_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inv_transactions" ON investment_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inv_transactions" ON investment_transactions FOR DELETE USING (auth.uid() = user_id);

-- Budgets
CREATE POLICY "Users can view own budgets" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (auth.uid() = user_id);

-- Goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Net worth
CREATE POLICY "Users can view own net_worth" ON net_worth_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own net_worth" ON net_worth_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own net_worth" ON net_worth_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own net_worth" ON net_worth_snapshots FOR DELETE USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE USING (auth.uid() = user_id);

-- Reports
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON reports FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipts', 'receipts', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('loan-documents', 'loan-documents', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('investment-documents', 'investment-documents', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own folder {user_id}/...
CREATE POLICY "Users can upload own receipts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own receipts" ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own receipts" ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own loan docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own loan docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own loan docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own loan docs" ON storage.objects FOR DELETE
  USING (bucket_id = 'loan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own investment docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'investment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own investment docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'investment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own investment docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'investment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own investment docs" ON storage.objects FOR DELETE
  USING (bucket_id = 'investment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Credit card EMI plans + mark purchases converted to EMI.
-- Run after 007_recurring_budgets.sql

CREATE TABLE IF NOT EXISTS credit_card_emis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  source_transaction_id UUID REFERENCES credit_card_transactions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  principal NUMERIC(15, 2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(6, 3) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  tenure_months INT NOT NULL CHECK (tenure_months > 0),
  emi_amount NUMERIC(15, 2) NOT NULL CHECK (emi_amount > 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  emis_paid INT NOT NULL DEFAULT 0 CHECK (emis_paid >= 0),
  outstanding_principal NUMERIC(15, 2) NOT NULL CHECK (outstanding_principal >= 0),
  processing_fee NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (processing_fee >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_emis_user_id ON credit_card_emis(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_emis_card_id ON credit_card_emis(credit_card_id);

ALTER TABLE credit_card_transactions
  ADD COLUMN IF NOT EXISTS converted_to_emi BOOLEAN NOT NULL DEFAULT FALSE;

DROP TRIGGER IF EXISTS trg_credit_card_emis_updated_at ON credit_card_emis;
CREATE TRIGGER trg_credit_card_emis_updated_at
  BEFORE UPDATE ON credit_card_emis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE credit_card_emis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cc_emis" ON credit_card_emis;
DROP POLICY IF EXISTS "Users can insert own cc_emis" ON credit_card_emis;
DROP POLICY IF EXISTS "Users can update own cc_emis" ON credit_card_emis;
DROP POLICY IF EXISTS "Users can delete own cc_emis" ON credit_card_emis;

CREATE POLICY "Users can view own cc_emis"
  ON credit_card_emis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cc_emis"
  ON credit_card_emis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cc_emis"
  ON credit_card_emis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cc_emis"
  ON credit_card_emis FOR DELETE USING (auth.uid() = user_id);

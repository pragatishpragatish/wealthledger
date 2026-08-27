-- Quote identifiers for auto price updates (Yahoo ticker or AMFI scheme code).
-- Run after 009_broker_wallet_accounts.sql

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS symbol TEXT,
  ADD COLUMN IF NOT EXISTS last_priced_at TIMESTAMPTZ;

COMMENT ON COLUMN investments.symbol IS
  'Yahoo Finance ticker (e.g. RELIANCE.NS) for stocks/ETF/crypto, or AMFI scheme code for mutual funds';

CREATE INDEX IF NOT EXISTS idx_investments_symbol
  ON investments (user_id)
  WHERE symbol IS NOT NULL AND is_active = TRUE;

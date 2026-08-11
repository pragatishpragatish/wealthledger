-- ============================================================
-- Migration 003: SIP fields on investments
-- Run after 001 and 002 in Supabase SQL Editor
-- ============================================================

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS is_sip BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sip_amount NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sip_day INT CHECK (sip_day IS NULL OR (sip_day BETWEEN 1 AND 28)),
  ADD COLUMN IF NOT EXISTS sip_frequency TEXT DEFAULT 'monthly'
    CHECK (sip_frequency IS NULL OR sip_frequency IN ('monthly', 'weekly', 'quarterly')),
  ADD COLUMN IF NOT EXISTS sip_start_date DATE;

CREATE INDEX IF NOT EXISTS idx_investments_is_sip
  ON investments(user_id, is_sip)
  WHERE is_sip = TRUE;

-- ============================================================
-- Migration 002: Quarterly investment value reminder
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE 'investment_update';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS notify_investment_update BOOLEAN NOT NULL DEFAULT TRUE;

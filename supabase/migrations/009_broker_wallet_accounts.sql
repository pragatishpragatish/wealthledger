-- Broker wallet accounts (Groww, Zerodha, Dhan, Lemonn, etc.)
-- Run after 008_credit_card_emis.sql

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'broker_wallet';

-- Allow billing/due days 29–31; app clamps to month length at runtime.
ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS credit_cards_billing_date_check;
ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS credit_cards_due_date_check;

ALTER TABLE credit_cards
  ADD CONSTRAINT credit_cards_billing_date_check
  CHECK (billing_date BETWEEN 1 AND 31);

ALTER TABLE credit_cards
  ADD CONSTRAINT credit_cards_due_date_check
  CHECK (due_date BETWEEN 1 AND 31);

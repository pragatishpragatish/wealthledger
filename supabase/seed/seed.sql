-- ============================================================
-- Seed data for demo / development
-- Replace :user_id with a real auth.users id after signup
-- Or run via: SELECT seed_demo_data('your-uuid-here');
-- ============================================================

CREATE OR REPLACE FUNCTION seed_demo_data(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_hdfc UUID;
  v_sbi UUID;
  v_cash UUID;
  v_salary_cat UUID;
  v_food_cat UUID;
  v_rent_cat UUID;
  v_fuel_cat UUID;
  v_groceries_cat UUID;
  v_freelance_cat UUID;
  v_cc_id UUID;
  v_loan_id UUID;
  v_inv_mf UUID;
  v_inv_fd UUID;
  v_inv_stock UUID;
  i INT;
BEGIN
  -- Accounts
  INSERT INTO accounts (id, user_id, name, bank_name, account_number, ifsc, account_type, opening_balance, current_balance, opening_date, notes)
  VALUES
    (gen_random_uuid(), p_user_id, 'HDFC Salary', 'HDFC Bank', '50100234567890', 'HDFC0001234', 'salary', 50000, 185420.50, '2023-01-15', 'Primary salary account'),
    (gen_random_uuid(), p_user_id, 'SBI Savings', 'State Bank of India', '12345678901', 'SBIN0000456', 'savings', 25000, 67280.00, '2022-06-01', 'Emergency buffer'),
    (gen_random_uuid(), p_user_id, 'Cash Wallet', 'Cash', NULL, NULL, 'cash_wallet', 5000, 2450.00, '2024-01-01', 'Daily cash')
  RETURNING id INTO v_hdfc; -- only gets last; fix below

  SELECT id INTO v_hdfc FROM accounts WHERE user_id = p_user_id AND name = 'HDFC Salary';
  SELECT id INTO v_sbi FROM accounts WHERE user_id = p_user_id AND name = 'SBI Savings';
  SELECT id INTO v_cash FROM accounts WHERE user_id = p_user_id AND name = 'Cash Wallet';

  SELECT id INTO v_salary_cat FROM categories WHERE user_id = p_user_id AND name = 'Salary' AND kind = 'income';
  SELECT id INTO v_freelance_cat FROM categories WHERE user_id = p_user_id AND name = 'Freelance' AND kind = 'income';
  SELECT id INTO v_food_cat FROM categories WHERE user_id = p_user_id AND name = 'Food' AND kind = 'expense';
  SELECT id INTO v_rent_cat FROM categories WHERE user_id = p_user_id AND name = 'Rent' AND kind = 'expense';
  SELECT id INTO v_fuel_cat FROM categories WHERE user_id = p_user_id AND name = 'Fuel' AND kind = 'expense';
  SELECT id INTO v_groceries_cat FROM categories WHERE user_id = p_user_id AND name = 'Groceries' AND kind = 'expense';

  -- Credit card
  INSERT INTO credit_cards (id, user_id, bank, card_name, last_four, credit_limit, outstanding, statement_amount, minimum_due, paid_amount, billing_date, due_date, interest_rate, reward_type)
  VALUES (gen_random_uuid(), p_user_id, 'HDFC Bank', 'Regalia Gold', '4521', 300000, 48500, 48500, 2425, 0, 5, 20, 42.000, 'points')
  RETURNING id INTO v_cc_id;

  -- Loan
  INSERT INTO loans (
    id, user_id, name, bank, loan_type, principal, interest_rate, interest_type,
    input_mode, tenure_months, emi, start_date, outstanding_principal,
    principal_paid, interest_paid, emis_paid, processing_fee
  ) VALUES (
    gen_random_uuid(), p_user_id, 'Home Loan', 'SBI', 'home', 4500000, 8.500, 'reducing',
    'tenure', 240, 39042.15, '2022-04-01', 4125800.00,
    374200.00, 562500.00, 24, 11250
  ) RETURNING id INTO v_loan_id;

  -- Investments
  INSERT INTO investments (id, user_id, name, type, platform, purchase_date, units, buy_price, current_price, invested_amount, current_value)
  VALUES
    (gen_random_uuid(), p_user_id, 'Parag Parikh Flexi Cap', 'mutual_funds', 'Groww', '2023-03-15', 1250.456, 52.30, 78.45, 65398.85, 98100.00)
  RETURNING id INTO v_inv_mf;

  INSERT INTO investments (id, user_id, name, type, platform, purchase_date, invested_amount, current_value, maturity_date, interest_rate)
  VALUES
    (gen_random_uuid(), p_user_id, 'HDFC FD 7.1%', 'fd', 'HDFC Bank', '2024-06-01', 200000, 214200, '2025-06-01', 7.100)
  RETURNING id INTO v_inv_fd;

  INSERT INTO investments (id, user_id, name, type, platform, purchase_date, units, buy_price, current_price, invested_amount, current_value)
  VALUES
    (gen_random_uuid(), p_user_id, 'Reliance Industries', 'stocks', 'Zerodha', '2023-08-10', 50, 2450.00, 2980.00, 122500, 149000)
  RETURNING id INTO v_inv_stock;

  INSERT INTO investments (user_id, name, type, platform, purchase_date, units, buy_price, current_price, invested_amount, current_value)
  VALUES
    (p_user_id, 'Digital Gold', 'gold', 'Groww', '2024-01-20', 12.5, 6250, 7100, 78125, 88750),
    (p_user_id, 'Nifty 50 ETF', 'etf', 'Zerodha', '2023-11-01', 200, 210.50, 245.80, 42100, 49160);

  -- Sample transactions for last 6 months
  FOR i IN 0..5 LOOP
    -- Salary
    INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method, notes)
    VALUES (p_user_id, 'income', (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL + INTERVAL '1 day')::DATE,
            125000, v_salary_cat, v_hdfc, 'Employer Pvt Ltd', 'netbanking', 'Monthly salary');

    -- Rent
    INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method)
    VALUES (p_user_id, 'expense', (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL + INTERVAL '2 days')::DATE,
            28000, v_rent_cat, v_hdfc, 'Landlord', 'upi');

    -- Groceries
    INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method)
    VALUES (p_user_id, 'expense', (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL + INTERVAL '8 days')::DATE,
            8500 + (i * 200), v_groceries_cat, v_hdfc, 'BigBasket', 'upi');

    -- Food
    INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method)
    VALUES (p_user_id, 'expense', (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL + INTERVAL '12 days')::DATE,
            4200 + (i * 150), v_food_cat, v_hdfc, 'Swiggy', 'upi');

    -- Fuel
    INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method)
    VALUES (p_user_id, 'expense', (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL + INTERVAL '18 days')::DATE,
            3500, v_fuel_cat, v_hdfc, 'Indian Oil', 'card');
  END LOOP;

  -- Freelance income
  INSERT INTO transactions (user_id, type, date, amount, category_id, account_id, merchant, payment_method, notes)
  VALUES (p_user_id, 'income', CURRENT_DATE - 10, 45000, v_freelance_cat, v_hdfc, 'Client Corp', 'netbanking', 'Website redesign');

  -- Goals
  INSERT INTO goals (user_id, name, type, target_amount, current_amount, monthly_contribution, target_date, color)
  VALUES
    (p_user_id, 'Emergency Fund', 'emergency_fund', 500000, 185000, 15000, CURRENT_DATE + INTERVAL '18 months', '#0F766E'),
    (p_user_id, 'Goa Vacation', 'vacation', 80000, 32000, 8000, CURRENT_DATE + INTERVAL '6 months', '#0891B2'),
    (p_user_id, 'House Down Payment', 'house', 1500000, 420000, 25000, CURRENT_DATE + INTERVAL '36 months', '#2563EB');

  -- Budgets for current month
  INSERT INTO budgets (user_id, category_id, period, year, month, amount, spent)
  VALUES
    (p_user_id, v_food_cat, 'monthly', EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, 12000, 4200),
    (p_user_id, v_groceries_cat, 'monthly', EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, 10000, 8500),
    (p_user_id, v_fuel_cat, 'monthly', EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, 5000, 3500),
    (p_user_id, v_rent_cat, 'monthly', EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, 28000, 28000);

  -- Net worth snapshots (last 6 months)
  FOR i IN 0..5 LOOP
    INSERT INTO net_worth_snapshots (
      user_id, snapshot_date, total_cash, total_investments, total_assets,
      total_liabilities, credit_card_outstanding, loan_outstanding, net_worth
    ) VALUES (
      p_user_id,
      (DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::INTERVAL)::DATE,
      200000 - (i * 8000),
      450000 - (i * 15000),
      650000 - (i * 23000),
      4200000 + (i * 20000),
      40000 + (i * 2000),
      4160000 + (i * 18000),
      (650000 - (i * 23000)) - (4200000 + (i * 20000))
    ) ON CONFLICT (user_id, snapshot_date) DO NOTHING;
  END LOOP;

  -- Notifications
  INSERT INTO notifications (user_id, type, title, message, due_date, link)
  VALUES
    (p_user_id, 'credit_card_due', 'HDFC Regalia Gold Due', 'Minimum due ₹2,425. Statement amount ₹48,500.',
     MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, LEAST(20, 28)),
     '/credit-cards'),
    (p_user_id, 'emi_due', 'Home Loan EMI Due', 'EMI of ₹39,042.15 is due soon.',
     MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, LEAST(5, 28)),
     '/loans'),
    (p_user_id, 'fd_maturity', 'HDFC FD Maturing', 'Your FD of ₹2,00,000 matures on 1 Jun 2025.',
     '2025-06-01', '/investments');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

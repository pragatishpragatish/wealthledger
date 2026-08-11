-- ============================================================
-- Migration 006: Extra default categories
-- Expense: Subscriptions, Gym
-- Income: Trading Returns, Stock Returns
-- Safe to re-run — skips categories that already exist per user.
-- ============================================================

-- Backfill for existing users
INSERT INTO public.categories (user_id, name, kind, icon, color, is_system, sort_order)
SELECT p.id, v.name, v.kind::public.category_kind, v.icon, v.color, TRUE, v.sort_order
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('Subscriptions', 'expense', 'repeat', '#7C3AED', 5),
    ('Gym', 'expense', 'dumbbell', '#DC2626', 6),
    ('Trading Returns', 'income', 'candlestick-chart', '#EA580C', 7),
    ('Stock Returns', 'income', 'trending-up', '#0D9488', 8)
) AS v(name, kind, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id
    AND c.name = v.name
    AND c.kind::text = v.kind
    AND c.parent_id IS NULL
);

-- Keep new-user seed in sync (redefine handle_new_user category inserts)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.settings (user_id) VALUES (NEW.id);

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_system, sort_order) VALUES
    (NEW.id, 'Salary', 'income', 'briefcase', '#0F766E', TRUE, 1),
    (NEW.id, 'Freelance', 'income', 'laptop', '#0891B2', TRUE, 2),
    (NEW.id, 'Business', 'income', 'building-2', '#2563EB', TRUE, 3),
    (NEW.id, 'Rental', 'income', 'home', '#7C3AED', TRUE, 4),
    (NEW.id, 'Interest', 'income', 'percent', '#CA8A04', TRUE, 5),
    (NEW.id, 'Dividend', 'income', 'pie-chart', '#16A34A', TRUE, 6),
    (NEW.id, 'Trading Returns', 'income', 'candlestick-chart', '#EA580C', TRUE, 7),
    (NEW.id, 'Stock Returns', 'income', 'trending-up', '#0D9488', TRUE, 8),
    (NEW.id, 'Cashback', 'income', 'gift', '#DB2777', TRUE, 9),
    (NEW.id, 'Gifts', 'income', 'heart', '#E11D48', TRUE, 10),
    (NEW.id, 'Others', 'income', 'ellipsis', '#64748B', TRUE, 11);

  INSERT INTO public.categories (user_id, name, kind, icon, color, is_system, sort_order) VALUES
    (NEW.id, 'Food', 'expense', 'utensils', '#EA580C', TRUE, 1),
    (NEW.id, 'Groceries', 'expense', 'shopping-cart', '#16A34A', TRUE, 2),
    (NEW.id, 'Fuel', 'expense', 'fuel', '#CA8A04', TRUE, 3),
    (NEW.id, 'Shopping', 'expense', 'shopping-bag', '#DB2777', TRUE, 4),
    (NEW.id, 'Subscriptions', 'expense', 'repeat', '#7C3AED', TRUE, 5),
    (NEW.id, 'Gym', 'expense', 'dumbbell', '#DC2626', TRUE, 6),
    (NEW.id, 'Medical', 'expense', 'heart-pulse', '#E11D48', TRUE, 7),
    (NEW.id, 'Travel', 'expense', 'plane', '#2563EB', TRUE, 8),
    (NEW.id, 'Entertainment', 'expense', 'clapperboard', '#9333EA', TRUE, 9),
    (NEW.id, 'Utilities', 'expense', 'zap', '#0891B2', TRUE, 10),
    (NEW.id, 'Education', 'expense', 'graduation-cap', '#4F46E5', TRUE, 11),
    (NEW.id, 'Insurance', 'expense', 'shield', '#0F766E', TRUE, 12),
    (NEW.id, 'EMI', 'expense', 'credit-card', '#B45309', TRUE, 13),
    (NEW.id, 'Investment', 'expense', 'trending-up', '#15803D', TRUE, 14),
    (NEW.id, 'Rent', 'expense', 'building', '#475569', TRUE, 15),
    (NEW.id, 'Tax', 'expense', 'receipt', '#991B1B', TRUE, 16),
    (NEW.id, 'Misc', 'expense', 'ellipsis', '#64748B', TRUE, 17);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

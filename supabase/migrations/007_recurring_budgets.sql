-- ============================================================
-- Migration 007: Recurring budgets + amount edit history
-- ============================================================

-- Templates that auto-seed period budgets
CREATE TABLE IF NOT EXISTS public.budget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  period public.budget_period NOT NULL DEFAULT 'monthly',
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_templates_unique UNIQUE (user_id, category_id, period)
);

CREATE INDEX IF NOT EXISTS idx_budget_templates_user_id
  ON public.budget_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_templates_active
  ON public.budget_templates(user_id, is_active)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_budget_templates_updated_at
  BEFORE UPDATE ON public.budget_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link period budgets to their template (optional)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS template_id UUID
    REFERENCES public.budget_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_template_id
  ON public.budgets(user_id, template_id);

-- Amount change log
CREATE TYPE public.budget_history_source AS ENUM (
  'create',
  'edit',
  'recurring_seed'
);

CREATE TABLE IF NOT EXISTS public.budget_amount_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  period public.budget_period NOT NULL,
  year INT NOT NULL CHECK (year >= 2000),
  month INT CHECK (month IS NULL OR (month BETWEEN 1 AND 12)),
  old_amount NUMERIC(15, 2),
  new_amount NUMERIC(15, 2) NOT NULL CHECK (new_amount > 0),
  source public.budget_history_source NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_amount_history_user
  ON public.budget_amount_history(user_id, category_id, year);
CREATE INDEX IF NOT EXISTS idx_budget_amount_history_budget
  ON public.budget_amount_history(budget_id);

-- RLS
ALTER TABLE public.budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_amount_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget_templates"
  ON public.budget_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budget_templates"
  ON public.budget_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget_templates"
  ON public.budget_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget_templates"
  ON public.budget_templates FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own budget_amount_history"
  ON public.budget_amount_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budget_amount_history"
  ON public.budget_amount_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget_amount_history"
  ON public.budget_amount_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget_amount_history"
  ON public.budget_amount_history FOR DELETE USING (auth.uid() = user_id);

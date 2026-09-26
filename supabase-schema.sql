-- ============================================================
-- Expense Tracker — Supabase SQL Setup
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- 1. Monthly Income table
CREATE TABLE IF NOT EXISTS monthly_income (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  month      INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, year, month)
);

-- 2. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category        TEXT NOT NULL,
  custom_category TEXT,
  note            TEXT,
  date            DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses (user_id, date);

CREATE INDEX IF NOT EXISTS idx_monthly_income_user_year_month
  ON monthly_income (user_id, year, month);

-- 4. Enable Row Level Security
ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — monthly_income
CREATE POLICY "Users can view own income"
  ON monthly_income FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income"
  ON monthly_income FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income"
  ON monthly_income FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income"
  ON monthly_income FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RLS Policies — expenses
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

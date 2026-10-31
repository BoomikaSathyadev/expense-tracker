-- Multiple dated income records. Keep monthly_income intact as a recovery source.
CREATE TABLE IF NOT EXISTS income_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (length(trim(source)) > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  legacy_monthly_income_id UUID UNIQUE REFERENCES monthly_income(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_records_user_date
  ON income_records (user_id, date);

ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own income records"
  ON income_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income records"
  ON income_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income records"
  ON income_records FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own income records"
  ON income_records FOR DELETE USING (auth.uid() = user_id);

-- Migrate each existing monthly amount once, dated to the first day of its month.
-- The legacy table and rows remain untouched for recovery and comparison.
INSERT INTO income_records (user_id, source, amount, date, note, legacy_monthly_income_id)
SELECT user_id,
       'Legacy monthly income',
       amount,
       make_date(year, month, 1),
       'Migrated from the previous monthly income setting',
       id
FROM monthly_income
WHERE amount > 0
ON CONFLICT (legacy_monthly_income_id) DO NOTHING;

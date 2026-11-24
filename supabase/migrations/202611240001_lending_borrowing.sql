CREATE TABLE IF NOT EXISTS lending_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('lent', 'borrowed')),
  person_name TEXT NOT NULL CHECK (length(trim(person_name)) > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lending_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES lending_transactions(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lending_transactions_user_type_date
  ON lending_transactions (user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_lending_repayments_user_transaction_date
  ON lending_repayments (user_id, transaction_id, date DESC);

ALTER TABLE lending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_repayments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON lending_transactions, lending_repayments TO authenticated;

CREATE POLICY "Users can manage own lending transactions"
  ON lending_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own lending repayments"
  ON lending_repayments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION prevent_lending_amount_below_repayments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  repaid NUMERIC(12, 2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
    INTO repaid
    FROM lending_repayments
   WHERE transaction_id = NEW.id;

  IF repaid > NEW.amount THEN
    RAISE EXCEPTION 'Transaction amount cannot be less than its recorded repayments';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lending_transaction_repayment_amount_check
  BEFORE UPDATE OF amount ON lending_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lending_amount_below_repayments();

CREATE OR REPLACE FUNCTION validate_lending_repayment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_user_id UUID;
  transaction_amount NUMERIC(12, 2);
  already_repaid NUMERIC(12, 2);
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.transaction_id <> OLD.transaction_id OR NEW.user_id <> OLD.user_id
  ) THEN
    RAISE EXCEPTION 'A repayment cannot be reassigned to another transaction or user';
  END IF;

  SELECT user_id, amount
    INTO transaction_user_id, transaction_amount
    FROM lending_transactions
   WHERE id = NEW.transaction_id
   FOR UPDATE;

  IF NOT FOUND OR transaction_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Repayment transaction does not belong to this user';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO already_repaid
    FROM lending_repayments
   WHERE transaction_id = NEW.transaction_id
     AND id <> NEW.id;

  IF already_repaid + NEW.amount > transaction_amount THEN
    RAISE EXCEPTION 'Repayment cannot exceed the transaction outstanding balance';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lending_repayment_balance_check
  BEFORE INSERT OR UPDATE ON lending_repayments
  FOR EACH ROW
  EXECUTE FUNCTION validate_lending_repayment();

export type Category =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Bills"
  | "Education"
  | "Entertainment"
  | "Health"
  | "Other";

export const CATEGORIES: Category[] = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Education",
  "Entertainment",
  "Health",
  "Other",
];

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: Category;
  custom_category: string | null;
  note: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface MonthlyIncome {
  id: string;
  user_id: string;
  year: number;
  month: number; // 1-12
  amount: number;
  created_at: string;
}

export interface MonthSummary {
  year: number;
  month: number;
  income: number;
  totalExpenses: number;
  savings: number;
  cumulativeSavings: number;
  categoryBreakdown: Record<string, number>;
}

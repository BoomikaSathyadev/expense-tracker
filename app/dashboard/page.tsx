"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { Expense, MonthlyIncome } from "@/lib/types";
import {
  formatCurrency,
  formatMonthYear,
  getCurrentYearMonth,
  formatDate,
} from "@/lib/utils";

function CategoryBreakdown({
  sortedCategories,
  expenses,
}: {
  sortedCategories: [string, number][];
  expenses: Expense[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
        By Category
      </p>
      <div className="space-y-1">
        {sortedCategories.map(([cat, amount]) => {
          const isOpen = expanded === cat;
          const catExpenses = expenses
            .filter((e) =>
              e.category === "Other" && e.custom_category
                ? e.custom_category === cat
                : e.category === cat
            )
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );

          return (
            <div key={cat}>
              <button
                onClick={() => setExpanded(isOpen ? null : cat)}
                className="w-full flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-gray-700 truncate">{cat}</span>
                  <span className="text-xs text-gray-400">
                    {catExpenses.length}x
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-sm font-medium text-gray-900 w-20 text-right">
                    {formatCurrency(amount)}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-400 transition-transform flex-shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="ml-2 mb-2 space-y-1 border-l-2 border-gray-100 pl-3">
                  {catExpenses.map((e) => (
                    <div key={e.id}>
                      <div className="w-full flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatDate(e.date)}
                          </span>
                          {e.note && (
                            <span className="text-xs text-gray-400 italic truncate">
                              {e.note}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-800 ml-2 flex-shrink-0">
                          {formatCurrency(e.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [income, setIncome] = useState<MonthlyIncome | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);
  const [cumulativeSavings, setCumulativeSavings] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<
    { year: number; month: number }[]
  >([]);

  const fetchData = useCallback(
    async (year: number, month: number) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }

      const [incomeRes, expensesRes, allIncomeRes, allExpensesRes] =
        await Promise.all([
          supabase
            .from("monthly_income")
            .select("*")
            .eq("user_id", user.id)
            .eq("year", year)
            .eq("month", month)
            .maybeSingle(),
          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
            .lte(
              "date",
              `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`
            )
            .order("date", { ascending: false }),
          supabase
            .from("monthly_income")
            .select("year, month, amount")
            .eq("user_id", user.id)
            .order("year", { ascending: true })
            .order("month", { ascending: true }),
          supabase
            .from("expenses")
            .select("date, amount")
            .eq("user_id", user.id),
        ]);

      setIncome(incomeRes.data);
      setExpenses(expensesRes.data || []);

      // Build available months from income + expenses
      const monthSet = new Set<string>();
      (allIncomeRes.data || []).forEach((r: { year: number; month: number }) =>
        monthSet.add(`${r.year}-${r.month}`)
      );
      (allExpensesRes.data || []).forEach((r: { date: string }) => {
        const d = new Date(r.date);
        monthSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      });
      // Always include current month
      const { year: cy, month: cm } = getCurrentYearMonth();
      monthSet.add(`${cy}-${cm}`);

      const months = Array.from(monthSet)
        .map((s) => {
          const [y, m] = s.split("-").map(Number);
          return { year: y, month: m };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month);
      setAvailableMonths(months);

      // Cumulative savings: sum all months up to and including selected
      let cumulative = 0;
      for (const m of months) {
        if (m.year > year || (m.year === year && m.month > month)) break;
        const inc =
          (allIncomeRes.data || []).find(
            (r: { year: number; month: number; amount: number }) =>
              r.year === m.year && r.month === m.month
          )?.amount || 0;
        const exp = (allExpensesRes.data || [])
          .filter((r: { date: string; amount: number }) => {
            const d = new Date(r.date);
            return (
              d.getFullYear() === m.year && d.getMonth() + 1 === m.month
            );
          })
          .reduce(
            (sum: number, r: { date: string; amount: number }) =>
              sum + r.amount,
            0
          );
        cumulative += inc - exp;
      }
      setCumulativeSavings(cumulative);
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    const { year, month } = getCurrentYearMonth();
    setSelectedYear(year);
    setSelectedMonth(month);
    fetchData(year, month);
  }, [fetchData]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-").map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
    setLoading(true);
    fetchData(y, m);
  }

  async function saveIncome() {
    const val = parseFloat(incomeInput);
    if (isNaN(val) || val < 0) {
      setIncomeError("Enter a valid amount");
      return;
    }
    setSavingIncome(true);
    setIncomeError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (income) {
      await supabase
        .from("monthly_income")
        .update({ amount: val })
        .eq("id", income.id);
    } else {
      await supabase.from("monthly_income").insert({
        user_id: user.id,
        year: selectedYear,
        month: selectedMonth,
        amount: val,
      });
    }
    setEditingIncome(false);
    setSavingIncome(false);
    fetchData(selectedYear, selectedMonth);
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const incomeAmount = income?.amount || 0;
  const savings = incomeAmount - totalExpenses;

  const categoryBreakdown: Record<string, number> = {};
  expenses.forEach((e) => {
    const key =
      e.category === "Other" && e.custom_category
        ? e.custom_category
        : e.category;
    categoryBreakdown[key] = (categoryBreakdown[key] || 0) + e.amount;
  });
  const sortedCategories = Object.entries(categoryBreakdown).sort(
    (a, b) => b[1] - a[1]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {formatMonthYear(selectedYear, selectedMonth)}
          </h1>
        </div>
        <select
          value={`${selectedYear}-${selectedMonth}`}
          onChange={handleMonthChange}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
        >
          {availableMonths.map(({ year, month }) => (
            <option key={`${year}-${month}`} value={`${year}-${month}`}>
              {formatMonthYear(year, month)}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="px-4 space-y-3">
        {/* Income */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Income
              </p>
              {editingIncome ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-gray-500">₹</span>
                  <input
                    type="number"
                    value={incomeInput}
                    onChange={(e) => setIncomeInput(e.target.value)}
                    className="w-32 border-b border-gray-400 text-lg font-semibold focus:outline-none"
                    autoFocus
                    min="0"
                  />
                </div>
              ) : (
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {incomeAmount > 0 ? formatCurrency(incomeAmount) : "—"}
                </p>
              )}
              {incomeError && (
                <p className="text-red-500 text-xs mt-1">{incomeError}</p>
              )}
            </div>
            <div className="flex gap-2">
              {editingIncome ? (
                <>
                  <button
                    onClick={saveIncome}
                    disabled={savingIncome}
                    className="text-sm text-gray-900 font-medium border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingIncome(false);
                      setIncomeError("");
                    }}
                    className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditingIncome(true);
                    setIncomeInput(incomeAmount > 0 ? String(incomeAmount) : "");
                  }}
                  className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5"
                >
                  {incomeAmount > 0 ? "Edit" : "Set"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expenses + Savings row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Expenses
            </p>
            <p className="text-xl font-semibold text-gray-900 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${
              savings >= 0
                ? "bg-white border-gray-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Savings
            </p>
            <p
              className={`text-xl font-semibold mt-1 ${
                savings >= 0 ? "text-gray-900" : "text-red-600"
              }`}
            >
              {formatCurrency(savings)}
            </p>
          </div>
        </div>

        {/* Cumulative savings */}
        <div className="bg-gray-900 text-white rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Total Accumulated Savings
          </p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              cumulativeSavings >= 0 ? "text-white" : "text-red-400"
            }`}
          >
            {formatCurrency(cumulativeSavings)}
          </p>
        </div>

        {/* Category Breakdown */}
        {sortedCategories.length > 0 && (
          <CategoryBreakdown
            sortedCategories={sortedCategories}
            expenses={expenses}
          />
        )}

        {/* Empty state */}
        {expenses.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No expenses this month.
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

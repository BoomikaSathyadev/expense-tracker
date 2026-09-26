"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { Expense, CATEGORIES, Category } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  getCurrentYearMonth,
} from "@/lib/utils";

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<
    { year: number; month: number }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    category: "" as Category | "",
    customCategory: "",
    note: "",
    date: "",
  });
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExpenses = useCallback(
    async (year: number, month: number) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }

      const lastDay = new Date(year, month, 0).getDate();
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lte("date", `${year}-${String(month).padStart(2, "0")}-${lastDay}`)
        .order("date", { ascending: false });

      setExpenses(data || []);
      setLoading(false);
    },
    [router]
  );

  const fetchAvailableMonths = useCallback(
    async (currentYear: number, currentMonth: number) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("expenses")
        .select("date")
        .eq("user_id", user.id);

      const monthSet = new Set<string>();
      monthSet.add(`${currentYear}-${currentMonth}`);
      (data || []).forEach((r: { date: string }) => {
        const d = new Date(r.date);
        monthSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      });

      const months = Array.from(monthSet)
        .map((s) => {
          const [y, m] = s.split("-").map(Number);
          return { year: y, month: m };
        })
        .sort((a, b) => b.year - a.year || b.month - a.month);

      setAvailableMonths(months);
    },
    []
  );

  useEffect(() => {
    const { year, month } = getCurrentYearMonth();
    setSelectedYear(year);
    setSelectedMonth(month);
    fetchAvailableMonths(year, month);
    fetchExpenses(year, month);
  }, [fetchExpenses, fetchAvailableMonths]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-").map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
    setLoading(true);
    fetchExpenses(y, m);
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditForm({
      amount: String(expense.amount),
      category: expense.category,
      customCategory: expense.custom_category || "",
      note: expense.note || "",
      date: expense.date,
    });
    setEditError("");
  }

  async function saveEdit() {
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setEditError("Enter a valid positive amount");
      return;
    }
    if (!editForm.category) {
      setEditError("Select a category");
      return;
    }
    if (editForm.category === "Other" && !editForm.customCategory.trim()) {
      setEditError("Enter a custom category name");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .update({
        amount: amt,
        category: editForm.category,
        custom_category:
          editForm.category === "Other"
            ? editForm.customCategory.trim() || null
            : null,
        note: editForm.note.trim() || null,
        date: editForm.date,
      })
      .eq("id", editingId!);

    if (error) {
      setEditError(error.message);
      setSaving(false);
      return;
    }

    setEditingId(null);
    setSaving(false);
    fetchExpenses(selectedYear, selectedMonth);
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setDeletingId(null);
    fetchExpenses(selectedYear, selectedMonth);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">History</h1>
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

      <div className="px-4 space-y-2">
        {expenses.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No expenses for {formatMonthYear(selectedYear, selectedMonth)}.
          </p>
        )}

        {expenses.map((expense) =>
          editingId === expense.id ? (
            <div
              key={expense.id}
              className="bg-white border border-gray-300 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500">₹</span>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount: e.target.value })
                  }
                  className="flex-1 border-b border-gray-300 py-1 focus:outline-none text-gray-900"
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setEditForm({ ...editForm, category: cat })
                    }
                    className={`py-1.5 text-xs rounded-lg border ${
                      editForm.category === cat
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {editForm.category === "Other" && (
                <input
                  type="text"
                  value={editForm.customCategory}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      customCategory: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="Custom category"
                />
              )}

              <input
                type="text"
                value={editForm.note}
                onChange={(e) =>
                  setEditForm({ ...editForm, note: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Note (optional)"
              />

              <input
                type="date"
                value={editForm.date}
                onChange={(e) =>
                  setEditForm({ ...editForm, date: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />

              {editError && (
                <p className="text-red-500 text-xs">{editError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={expense.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {expense.category === "Other" && expense.custom_category
                        ? expense.custom_category
                        : expense.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(expense.date)}
                    </span>
                  </div>
                  {expense.note && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {expense.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-base font-semibold text-gray-900">
                    {formatCurrency(expense.amount)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(expense)}
                      className="text-gray-400 hover:text-gray-700 p-1"
                      aria-label="Edit"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      disabled={deletingId === expense.id}
                      className="text-gray-400 hover:text-red-500 p-1 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { CATEGORIES, Category } from "@/lib/types";
import { getTodayString } from "@/lib/utils";

export default function AddExpensePage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [customCategory, setCustomCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid positive amount");
      return;
    }
    if (!category) {
      setError("Select a category");
      return;
    }
    if (category === "Other" && !customCategory.trim()) {
      setError("Enter a custom category name");
      return;
    }
    if (!date) {
      setError("Select a date");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }

    const { error: dbError } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: amt,
      category,
      custom_category:
        category === "Other" ? customCategory.trim() || null : null,
      note: note.trim() || null,
      date,
    });

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Add Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              ₹
            </span>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-2 px-1 text-sm rounded-lg border transition-colors ${
                  category === cat
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Category */}
        {category === "Other" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Category <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
              placeholder="e.g. Gifts"
            />
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
            placeholder="e.g. Lunch at office"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium disabled:opacity-50 mt-2"
        >
          {saving ? "Saving…" : "Add Expense"}
        </button>
      </form>

      <BottomNav />
    </div>
  );
}

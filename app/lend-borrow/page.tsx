"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { fetchAllPages } from "@/lib/lending";
import { createClient } from "@/lib/supabase";
import { notifyFinancialRecordsChanged } from "@/lib/financial-events";
import { formatCurrency, formatDate, getTodayString } from "@/lib/utils";

type TransactionType = "lent" | "borrowed";

interface LendingTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  person_name: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

interface Repayment {
  id: string;
  user_id: string;
  transaction_id: string;
  amount: number;
  date: string;
  created_at: string;
}

interface PersonGroup {
  key: string;
  personName: string;
  transactions: LendingTransaction[];
  originalCents: number;
  outstandingCents: number;
}

const cents = (amount: number) => Math.round(Number(amount) * 100);
const normalizedName = (name: string) => name.trim().toLowerCase();

export default function LendBorrowPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<LendingTransaction[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    type: "lent" as TransactionType,
    personName: "",
    amount: "",
    date: getTodayString(),
    note: "",
  });
  const [transactionError, setTransactionError] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [repaymentTarget, setRepaymentTarget] =
    useState<LendingTransaction | null>(null);
  const [editingRepaymentId, setEditingRepaymentId] = useState<string | null>(
    null
  );
  const [repaymentForm, setRepaymentForm] = useState({
    amount: "",
    date: getTodayString(),
  });
  const [repaymentError, setRepaymentError] = useState("");
  const [savingRepayment, setSavingRepayment] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<
    Record<TransactionType, boolean>
  >({ lent: false, borrowed: false });
  const [expandedRepaymentHistories, setExpandedRepaymentHistories] =
    useState<Set<string>>(new Set());

  const fetchRecords = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setPageError("");
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setPageError(userError.message);
        setLoading(false);
        return;
      }
      if (!user) {
        router.replace("/auth");
        setLoading(false);
        return;
      }

      const [transactionsResult, repaymentsResult] = await Promise.all([
        fetchAllPages((from, to) =>
          supabase
            .from("lending_transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to)
        ),
        fetchAllPages((from, to) =>
          supabase
            .from("lending_repayments")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to)
        ),
      ]);

      if (transactionsResult.error || repaymentsResult.error) {
        setPageError(
          transactionsResult.error?.message ||
            repaymentsResult.error?.message ||
            "Unable to load lending records."
        );
      } else {
        setTransactions(transactionsResult.data || []);
        setRepayments(repaymentsResult.data || []);
      }
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const repaymentsByTransaction = useMemo(() => {
    const result = new Map<string, Repayment[]>();
    for (const repayment of repayments) {
      const records = result.get(repayment.transaction_id) || [];
      records.push(repayment);
      result.set(repayment.transaction_id, records);
    }
    return result;
  }, [repayments]);

  const groups = useMemo(() => {
    const result: Record<TransactionType, PersonGroup[]> = {
      lent: [],
      borrowed: [],
    };
    const groupMap = new Map<string, PersonGroup>();

    for (const transaction of transactions) {
      const key = `${transaction.type}:${normalizedName(transaction.person_name)}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          key,
          personName: transaction.person_name,
          transactions: [],
          originalCents: 0,
          outstandingCents: 0,
        };
        groupMap.set(key, group);
        result[transaction.type].push(group);
      }
      group.transactions.push(transaction);
      group.originalCents += cents(transaction.amount);
      const repaidCents = (repaymentsByTransaction.get(transaction.id) || [])
        .reduce((sum, repayment) => sum + cents(repayment.amount), 0);
      group.outstandingCents += Math.max(0, cents(transaction.amount) - repaidCents);
    }

    result.lent.sort((a, b) => a.personName.localeCompare(b.personName));
    result.borrowed.sort((a, b) => a.personName.localeCompare(b.personName));
    return result;
  }, [transactions, repaymentsByTransaction]);

  const totalOutstanding = useMemo(
    () => ({
      lent:
        groups.lent.reduce((sum, group) => sum + group.outstandingCents, 0) /
        100,
      borrowed:
        groups.borrowed.reduce((sum, group) => sum + group.outstandingCents, 0) /
        100,
    }),
    [groups]
  );

  function openNewTransaction() {
    setEditingId(null);
    setTransactionForm({
      type: "lent",
      personName: "",
      amount: "",
      date: getTodayString(),
      note: "",
    });
    setTransactionError("");
    setFormOpen(true);
  }

  function openEditTransaction(transaction: LendingTransaction) {
    setEditingId(transaction.id);
    setTransactionForm({
      type: transaction.type,
      personName: transaction.person_name,
      amount: String(transaction.amount),
      date: transaction.date,
      note: transaction.note || "",
    });
    setTransactionError("");
    setFormOpen(true);
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(transactionForm.amount);
    const personName = transactionForm.personName.trim();
    if (!personName) {
      setTransactionError("Enter a person's name.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTransactionError("Enter a valid positive amount.");
      return;
    }
    if (!transactionForm.date) {
      setTransactionError("Select a transaction date.");
      return;
    }

    setSavingTransaction(true);
    setTransactionError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      setSavingTransaction(false);
      return;
    }

    const values = {
      type: transactionForm.type,
      person_name: personName,
      amount,
      date: transactionForm.date,
      note: transactionForm.note.trim() || null,
    };
    const { error } = editingId
      ? await supabase
          .from("lending_transactions")
          .update(values)
          .eq("id", editingId)
          .eq("user_id", user.id)
      : await supabase
          .from("lending_transactions")
          .insert({ ...values, user_id: user.id });

    if (error) {
      setTransactionError(error.message);
      setSavingTransaction(false);
      return;
    }
    setFormOpen(false);
    setSavingTransaction(false);
    notifyFinancialRecordsChanged();
    await fetchRecords(false);
  }

  async function deleteTransaction(transaction: LendingTransaction) {
    const transactionRepayments =
      repaymentsByTransaction.get(transaction.id) || [];
    const historyMessage =
      transactionRepayments.length > 0
        ? ` Its ${transactionRepayments.length} repayment record(s) and history will also be permanently deleted.`
        : "";
    if (
      !confirm(
        `Delete this ${transaction.type === "lent" ? "lent" : "borrowed"} transaction for ${transaction.person_name}?${historyMessage} This cannot be undone.`
      )
    ) {
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }
    const { error } = await supabase
      .from("lending_transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("user_id", user.id);
    if (error) {
      setPageError(error.message);
      return;
    }
    notifyFinancialRecordsChanged();
    await fetchRecords(false);
  }

  function openRepaymentForm(
    transaction: LendingTransaction,
    repayment?: Repayment
  ) {
    setRepaymentTarget(transaction);
    setEditingRepaymentId(repayment?.id || null);
    setRepaymentForm({
      amount: repayment ? String(repayment.amount) : "",
      date: repayment?.date || getTodayString(),
    });
    setRepaymentError("");
  }

  async function saveRepayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repaymentTarget) return;
    const amount = Number(repaymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRepaymentError("Enter a valid positive repayment amount.");
      return;
    }
    if (!repaymentForm.date) {
      setRepaymentError("Select a repayment date.");
      return;
    }

    setSavingRepayment(true);
    setRepaymentError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      setSavingRepayment(false);
      return;
    }

    const values = {
      amount,
      date: repaymentForm.date,
    };
    const { error } = editingRepaymentId
      ? await supabase
          .from("lending_repayments")
          .update(values)
          .eq("id", editingRepaymentId)
          .eq("user_id", user.id)
      : await supabase.from("lending_repayments").insert({
          ...values,
          transaction_id: repaymentTarget.id,
          user_id: user.id,
        });

    if (error) {
      setRepaymentError(error.message);
      setSavingRepayment(false);
      return;
    }
    setRepaymentTarget(null);
    setSavingRepayment(false);
    notifyFinancialRecordsChanged();
    await fetchRecords(false);
  }

  async function deleteRepayment(repayment: Repayment) {
    if (!confirm("Delete this repayment record? The outstanding balance will increase.")) {
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }
    const { error } = await supabase
      .from("lending_repayments")
      .delete()
      .eq("id", repayment.id)
      .eq("user_id", user.id);
    if (error) {
      setPageError(error.message);
      return;
    }
    notifyFinancialRecordsChanged();
    await fetchRecords(false);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSection(type: TransactionType) {
    setExpandedSections((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  function toggleRepaymentHistory(transactionId: string) {
    setExpandedRepaymentHistories((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
  }

  function renderSection(type: TransactionType, title: string) {
    const sectionGroups = groups[type];
    const total = totalOutstanding[type];
    const expanded = expandedSections[type];

    return (
      <section aria-labelledby={`${type}-heading`}>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-1">
              <h2
                id={`${type}-heading`}
                className="text-base font-semibold text-gray-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => toggleSection(type)}
                aria-expanded={expanded}
                aria-controls={`${type}-groups`}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {type === "lent" ? "Receivable" : "Payable"}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

        <div id={`${type}-groups`}>
          {expanded && sectionGroups.length > 0 && (
            <div className="border-t border-gray-100 p-3 space-y-3">
              {sectionGroups.map((group) => {
          const expanded = expandedGroups.has(group.key);
          const settled = group.outstandingCents === 0;
          return (
            <div
              key={group.key}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {group.personName}
                  </span>
                  <span className="block text-xs text-gray-400 mt-1">
                    {group.transactions.length}{" "}
                    {group.transactions.length === 1 ? "transaction" : "transactions"}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Original total{" "}
                    <span
                      className={
                        settled
                          ? "line-through decoration-gray-700 text-gray-600"
                          : "text-gray-700"
                      }
                    >
                      {formatCurrency(group.originalCents / 100)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      Outstanding
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(group.outstandingCents / 100)}
                    </span>
                    {settled && (
                      <span className="text-[10px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5 mt-1">
                        Settled
                      </span>
                    )}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {expanded && (
                <div className="divide-y divide-gray-100">
                  {group.transactions.map((transaction) => {
                    const transactionRepayments =
                      repaymentsByTransaction.get(transaction.id) || [];
                    const repaidCents = transactionRepayments.reduce(
                      (sum, repayment) => sum + cents(repayment.amount),
                      0
                    );
                    const outstandingCents = Math.max(
                      0,
                      cents(transaction.amount) - repaidCents
                    );
                    const editableRepaymentCents = editingRepaymentId
                      ? cents(
                          transactionRepayments.find(
                            (repayment) => repayment.id === editingRepaymentId
                          )?.amount || 0
                        )
                      : 0;
                    const repaymentAvailable =
                      (outstandingCents + editableRepaymentCents) / 100;
                    const repaymentHistoryExpanded =
                      expandedRepaymentHistories.has(transaction.id);

                    return (
                      <div key={transaction.id} className="p-4">
                        <div className="border-l border-gray-300 pl-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-600">
                            {formatDate(transaction.date)}
                          </p>
                          <p className="text-xs font-medium text-gray-800 text-right">
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                        {transaction.note && (
                          <p className="text-[11px] text-gray-500 mt-1 break-words">
                            {transaction.note}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-2">
                          Repaid {formatCurrency(repaidCents / 100)} · Remaining{" "}
                          {formatCurrency(outstandingCents / 100)}
                        </p>
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 mt-2">
                          {outstandingCents > 0 && (
                            <button
                              type="button"
                              onClick={() => openRepaymentForm(transaction)}
                              className="text-[10px] text-gray-700 underline"
                            >
                              Record repayment
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditTransaction(transaction)}
                            className="text-[10px] text-gray-500 underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTransaction(transaction)}
                            className="text-[10px] text-gray-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>

                        {transactionRepayments.length > 0 && (
                          <div className="mt-3 ml-1 border-l border-gray-300 pl-3 space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                toggleRepaymentHistory(transaction.id)
                              }
                              aria-expanded={repaymentHistoryExpanded}
                              aria-controls={`repayment-history-${transaction.id}`}
                              className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-gray-400"
                            >
                              Repayment History ({transactionRepayments.length})
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`text-gray-400 transition-transform ${repaymentHistoryExpanded ? "rotate-180" : ""}`}
                                aria-hidden="true"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {repaymentHistoryExpanded && (
                              <div
                                id={`repayment-history-${transaction.id}`}
                                className="space-y-2"
                              >
                                {transactionRepayments.map((repayment) => (
                                  <div
                                    key={repayment.id}
                                    className="flex items-start justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[11px] text-gray-600">
                                        {formatDate(repayment.date)} ·{" "}
                                        {formatCurrency(repayment.amount)}
                                      </p>
                                    </div>
                                    <span className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openRepaymentForm(
                                            transaction,
                                            repayment
                                          )
                                        }
                                        className="text-[10px] text-gray-500 underline"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteRepayment(repayment)
                                        }
                                        className="text-[10px] text-gray-400 hover:text-red-600"
                                      >
                                        Delete
                                      </button>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {repaymentTarget?.id === transaction.id && (
                          <form
                            onSubmit={saveRepayment}
                            className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg space-y-3"
                          >
                            <p className="text-xs font-medium text-gray-800">
                              {editingRepaymentId ? "Edit repayment" : "Record repayment"}
                            </p>
                            <div>
                              <label className="block text-[11px] text-gray-600 mb-1">
                                Amount (up to {formatCurrency(repaymentAvailable)})
                              </label>
                              <input
                                type="number"
                                required
                                min="0.01"
                                max={repaymentAvailable}
                                step="0.01"
                                value={repaymentForm.amount}
                                onChange={(event) =>
                                  setRepaymentForm({
                                    ...repaymentForm,
                                    amount: event.target.value,
                                  })
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <input
                              type="date"
                              required
                              value={repaymentForm.date}
                              onChange={(event) =>
                                setRepaymentForm({
                                  ...repaymentForm,
                                  date: event.target.value,
                                })
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                              aria-label="Repayment date"
                            />
                            {repaymentError && (
                              <p className="text-[11px] text-red-600">{repaymentError}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={savingRepayment}
                                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-xs disabled:opacity-50"
                              >
                                {savingRepayment ? "Saving…" : "Save repayment"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRepaymentTarget(null)}
                                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
              })}
            </div>
          )}

          {sectionGroups.length === 0 && (
            <div className="border-t border-gray-100 px-4 py-6 text-center text-sm text-gray-400">
              No {type === "lent" ? "money lent" : "money borrowed"} records yet.
            </div>
          )}
        </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto">
      <header className="px-4 pt-8 pb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Lend & Borrow</h1>
        <button
          type="button"
          onClick={openNewTransaction}
          className="bg-gray-900 text-white rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap"
        >
          Add Transaction
        </button>
      </header>

      <main className="px-4 space-y-6">
        {pageError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {pageError}
          </p>
        )}

        {formOpen && (
          <form
            onSubmit={saveTransaction}
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {editingId ? "Edit transaction" : "Add transaction"}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-xs text-gray-500 underline"
              >
                Cancel
              </button>
            </div>
            <fieldset>
              <legend className="block text-xs text-gray-600 mb-1">
                Transaction type
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["lent", "borrowed"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, type })}
                    aria-pressed={transactionForm.type === type}
                    className={`border rounded-lg py-2 text-sm ${transactionForm.type === type ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"}`}
                  >
                    {type === "lent" ? "Money Lent" : "Money Borrowed"}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs text-gray-600">
              Person's name <span className="text-red-500">*</span>
              <input
                type="text"
                required
                maxLength={120}
                value={transactionForm.personName}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    personName: event.target.value,
                  })
                }
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                placeholder="Enter a name"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Amount <span className="text-red-500">*</span>
              <span className="relative block mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(event) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: event.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900"
                  placeholder="0.00"
                />
              </span>
            </label>
            <label className="block text-xs text-gray-600">
              Transaction date <span className="text-red-500">*</span>
              <input
                type="date"
                required
                value={transactionForm.date}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    date: event.target.value,
                  })
                }
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Note <span className="text-gray-400">(optional)</span>
              <input
                type="text"
                maxLength={500}
                value={transactionForm.note}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    note: event.target.value,
                  })
                }
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                placeholder="Purpose or description"
              />
            </label>
            {transactionError && (
              <p role="alert" className="text-xs text-red-600">
                {transactionError}
              </p>
            )}
            <button
              type="submit"
              disabled={savingTransaction}
              className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {savingTransaction ? "Saving…" : "Save transaction"}
            </button>
          </form>
        )}

        {renderSection("lent", "Money Lent")}
        {renderSection("borrowed", "Money Borrowed")}
      </main>

      <BottomNav />
    </div>
  );
}

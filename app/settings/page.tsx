"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [clearing, setClearing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth");
      } else {
        setUser(user);
      }
    });
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  async function handleClearData() {
    if (
      !confirm(
        "This will permanently delete ALL your expenses and income records. This cannot be undone. Continue?"
      )
    )
      return;

    setClearing(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await Promise.all([
      supabase.from("expenses").delete().eq("user_id", user.id),
      supabase.from("monthly_income").delete().eq("user_id", user.id),
    ]);

    setClearing(false);
    alert("All data cleared.");
    router.replace("/dashboard");
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      </div>

      <div className="px-4 space-y-3">
        {/* Account */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Account
          </p>
          <p className="text-sm text-gray-900">{user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Member since{" "}
            {new Date(user.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>

        {/* Clear Data */}
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Danger Zone
          </p>
          <p className="text-sm text-gray-600 mb-3">
            Permanently delete all your expenses and income records.
          </p>
          <button
            onClick={handleClearData}
            disabled={clearing}
            className="w-full border border-red-300 text-red-600 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear All Data"}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

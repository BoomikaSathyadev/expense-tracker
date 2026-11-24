"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const invalidLinkMessage =
  "This password reset link is invalid or has expired. Request a new reset link to continue.";

export default function ResetPasswordPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));
    const hasAuthError =
      url.searchParams.has("error") || hashParams.has("error");

    if (hasAuthError) {
      setError(invalidLinkMessage);
      setCheckingLink(false);
      return () => {
        active = false;
      };
    }

    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;

        if (sessionError || !data.session) {
          setError(invalidLinkMessage);
          setValidLink(false);
        } else {
          setValidLink(true);
        }
        setCheckingLink(false);
      })
      .catch(() => {
        if (!active) return;
        setError(invalidLinkMessage);
        setValidLink(false);
        setCheckingLink(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setUpdated(true);
        setMessage("Your password has been updated. You can now sign in.");
      }
    } catch {
      setError("Unable to update your password right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 max-w-sm mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900">
          Choose a new password
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Use at least 8 characters for your new password.
        </p>
      </div>

      {checkingLink ? (
        <p className="text-gray-500 text-sm">Checking your reset link…</p>
      ) : validLink ? (
        updated ? (
          <div className="space-y-4">
            <p className="text-green-700 text-sm">{message}</p>
            <Link
              href="/auth?password-reset=1"
              className="block w-full text-center bg-gray-900 text-white py-3 rounded-lg font-medium"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-900 focus:outline-none focus:border-gray-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "Please wait…" : "Update Password"}
            </button>
          </form>
        )
      ) : (
        <div className="space-y-4">
          <p className="text-red-600 text-sm">{error}</p>
          <Link
            href="/forgot-password"
            className="block w-full text-center bg-gray-900 text-white py-3 rounded-lg font-medium"
          >
            Request a new reset link
          </Link>
        </div>
      )}

    </div>
  );
}

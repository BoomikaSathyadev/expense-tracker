"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const invalidLinkMessage =
  "This password reset link is invalid or has expired. Request a new reset link to continue.";

export default function ConfirmRecoveryPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    const code = url.searchParams.get("code");
    const next = url.searchParams.get("next");

    if (
      ((!tokenHash || type !== "recovery") && !code) ||
      next !== "/reset-password"
    ) {
      setError(invalidLinkMessage);
      return () => {
        active = false;
      };
    }

    // Remove one-time credentials before creating the client, which otherwise
    // may process an authorization code automatically during initialization.
    url.searchParams.delete(tokenHash ? "token_hash" : "code");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    async function verifyRecoveryLink() {
      try {
        const supabase = createClient();
        const { error: verificationError } =
          tokenHash && type === "recovery"
            ? await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "recovery",
              })
            : code
              ? await supabase.auth.exchangeCodeForSession(code)
              : { error: new Error("Missing recovery credential") };

        if (!active) return;

        if (verificationError) {
          setError(invalidLinkMessage);
        } else {
          window.location.replace("/reset-password");
        }
      } catch {
        if (active) setError(invalidLinkMessage);
      }
    }

    void verifyRecoveryLink();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 max-w-sm mx-auto">
      {error ? (
        <div className="space-y-4">
          <p className="text-red-600 text-sm">{error}</p>
          <Link
            href="/forgot-password"
            className="block w-full text-center bg-gray-900 text-white py-3 rounded-lg font-medium"
          >
            Request a new reset link
          </Link>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Verifying your reset link…</p>
      )}
    </div>
  );
}

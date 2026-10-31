"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";

function ImpersonateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      toast.error("No impersonation token provided");
      router.replace("/");
      return;
    }

    api
      .post<{ user: unknown }>("/auth/impersonate", { token })
      .then(() => {
        toast.success("Signed in as tenant owner (impersonation mode)");
        router.replace("/");
      })
      .catch((err) => {
        toast.error((err as Error).message ?? "Impersonation failed");
        router.replace("/");
      });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground animate-pulse">
        Signing in as tenant…
      </p>
    </div>
  );
}

/**
 * Impersonation redirect page.
 *
 * The super admin panel opens this in a new tab with ?token=<short-lived-jwt>.
 * This page exchanges the token for a real tenant session cookie via
 * POST /api/v1/auth/impersonate, then redirects to the tenant dashboard.
 */
export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Loading…</p>
        </div>
      }
    >
      <ImpersonateContent />
    </Suspense>
  );
}

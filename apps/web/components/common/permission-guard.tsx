/**
 * PermissionGuard — client-side page-level access control.
 *
 * Renders `null` while the session loads, then either renders children (if the
 * user holds the required permission) or a polite access-denied message.
 * This is a defence-in-depth UX guard — the backend always enforces the real
 * permission check on every API call.
 */
"use client";

import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { ShieldAlert } from "lucide-react";

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { data, isLoading } = useCurrentUser();

  if (isLoading) return null;

  if (!hasPermission(data?.user, permission)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-base font-medium">Access restricted</p>
        <p className="max-w-sm text-sm">
          This section is managed by the platform administrator and is not
          available to tenant users.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

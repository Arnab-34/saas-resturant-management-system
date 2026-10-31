"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, ExternalLink, ShieldOff, ShieldCheck, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TenantStatusBadge } from "@/components/super-admin/TenantStatusBadge";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTenants,
  useSetTenantStatus,
  useImpersonateTenant,
  type Tenant,
  type TenantStatus,
} from "@/hooks/use-super-admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Quick-action button shown in the table row for the most common next step
function QuickAction({
  tenant,
  onAction,
}: {
  tenant: Tenant;
  onAction: (tenant: Tenant, next: TenantStatus) => void;
}) {
  switch (tenant.status) {
    case "TRIAL":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="text-green-600"
          title="Activate — move out of trial"
          onClick={() => onAction(tenant, "ACTIVE")}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Activate
        </Button>
      );
    case "ACTIVE":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-600"
          title="Suspend — freeze all users"
          onClick={() => onAction(tenant, "SUSPENDED")}
        >
          <ShieldOff className="h-3.5 w-3.5 mr-1" />
          Suspend
        </Button>
      );
    case "SUSPENDED":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="text-green-600"
          title="Activate — unfreeze users"
          onClick={() => onAction(tenant, "ACTIVE")}
        >
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          Unfreeze
        </Button>
      );
    case "EXPIRED":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600"
          title="Reactivate — restore access"
          onClick={() => onAction(tenant, "ACTIVE")}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Reactivate
        </Button>
      );
    case "CANCELLED":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600"
          title="Restore before purge"
          onClick={() => onAction(tenant, "ACTIVE")}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Restore
        </Button>
      );
    default:
      return null;
  }
}

function actionLabel(next: TenantStatus): string {
  const map: Record<TenantStatus, string> = {
    TRIAL: "Move to Trial",
    ACTIVE: "Activate / Unfreeze",
    SUSPENDED: "Suspend (Freeze)",
    EXPIRED: "Mark Expired",
    CANCELLED: "Cancel Tenant",
  };
  return map[next];
}

function actionDescription(tenant: Tenant, next: TenantStatus): string {
  const name = `"${tenant.name}"`;
  switch (next) {
    case "ACTIVE":
      return tenant.status === "SUSPENDED"
        ? `Unfreeze ${name}? All users will regain access immediately.`
        : `Activate ${name}? Moves them to full active status.`;
    case "SUSPENDED":
      return `Suspend ${name}? All users will be locked out immediately. You can unfreeze at any time.`;
    case "CANCELLED":
      return `Cancel ${name}? Data will be permanently deleted after the 30-day grace period.`;
    default:
      return `Change status of ${name} to ${next}.`;
  }
}

export default function TenantsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tenant: Tenant | null;
    nextStatus: TenantStatus;
  }>({ open: false, tenant: null, nextStatus: "ACTIVE" });

  const { data, isLoading } = useTenants({ page, status: statusFilter || undefined });
  const setStatus = useSetTenantStatus();
  const impersonate = useImpersonateTenant();

  const handleImpersonate = (tenant: Tenant) => {
    impersonate.mutate(tenant.id, {
      onSuccess: ({ token }) => {
        window.open(`/auth/impersonate?token=${encodeURIComponent(token)}`, "_blank");
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const openConfirm = (tenant: Tenant, nextStatus: TenantStatus) =>
    setConfirmDialog({ open: true, tenant, nextStatus });

  const handleStatusConfirm = () => {
    if (!confirmDialog.tenant) return;
    setStatus.mutate(
      { id: confirmDialog.tenant.id, status: confirmDialog.nextStatus },
      {
        onSuccess: () => {
          toast.success(
            `${confirmDialog.tenant!.name} → ${confirmDialog.nextStatus}`
          );
          setConfirmDialog((d) => ({ ...d, open: false }));
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? "…"} total tenants
          </p>
        </div>
        <Link href="/super-admin/tenants/new"><Button>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button></Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {(["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as TenantStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Slug</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Tier</th>
              <th className="text-left px-4 py-2.5 font-medium">Branches</th>
              <th className="text-left px-4 py-2.5 font-medium">Staff</th>
              <th className="text-left px-4 py-2.5 font-medium">Trial ends</th>
              <th className="text-left px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : data?.data.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/super-admin/tenants/${t.id}`}
                        className="hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {t.slug ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <TenantStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {t.subscriptionTier}
                    </td>
                    <td className="px-4 py-2.5">
                      {t._count?.branches ?? 0} / {t.maxBranches}
                    </td>
                    <td className="px-4 py-2.5">
                      {t._count?.users ?? 0} / {t.maxStaff}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {t.trialEndsAt
                        ? new Date(t.trialEndsAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {/* View */}
                        <Link href={`/super-admin/tenants/${t.id}`}><Button variant="ghost" size="sm">View</Button></Link>

                        {/* Impersonate */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleImpersonate(t)}
                          disabled={impersonate.isPending}
                          title="Login as tenant owner"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>

                        {/* Primary quick action based on current status */}
                        <QuickAction tenant={t} onAction={openConfirm} />
                      </div>
                    </td>
                  </tr>
                ))}
            {!isLoading && !data?.data.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No tenants found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="px-3 py-1.5 text-sm">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
        title={confirmDialog.tenant ? actionLabel(confirmDialog.nextStatus) : ""}
        description={
          confirmDialog.tenant
            ? actionDescription(confirmDialog.tenant, confirmDialog.nextStatus)
            : ""
        }
        confirmText={
          confirmDialog.nextStatus === "CANCELLED"
            ? (confirmDialog.tenant?.name ?? "")
            : undefined
        }
        confirmLabel={actionLabel(confirmDialog.nextStatus)}
        variant={confirmDialog.nextStatus === "CANCELLED" ? "destructive" : "default"}
        isPending={setStatus.isPending}
        onConfirm={handleStatusConfirm}
      />
    </div>
  );
}

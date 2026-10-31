"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, ShieldCheck, ShieldOff, RefreshCw, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantStatusBadge } from "@/components/super-admin/TenantStatusBadge";
import { ConfirmDialog } from "@/components/super-admin/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useTenant,
  useUpdateTenant,
  useSetTenantStatus,
  useImpersonateTenant,
  type TenantStatus,
  type SubscriptionTier,
} from "@/hooks/use-super-admin";

const TIER_DEFAULTS: Record<SubscriptionTier, { maxBranches: number; maxStaff: number }> = {
  STARTER: { maxBranches: 1, maxStaff: 10 },
  PROFESSIONAL: { maxBranches: 5, maxStaff: 50 },
  ENTERPRISE: { maxBranches: 999, maxStaff: 9999 },
};

// ─── Status transition map ──────────────────────────────────────────────────
// For each current status: list what actions super admin can take
type StatusAction = {
  label: string;
  icon: React.ReactNode;
  nextStatus: TenantStatus;
  variant: "default" | "outline" | "destructive" | "ghost";
  className?: string;
  requireTypeName?: boolean; // type the tenant name to confirm
  description: string;
};

function getAvailableActions(status: TenantStatus): StatusAction[] {
  switch (status) {
    case "TRIAL":
      return [
        {
          label: "Activate",
          icon: <Play className="h-4 w-4 mr-1.5" />,
          nextStatus: "ACTIVE",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700",
          description: "Move this tenant out of trial and into full ACTIVE status immediately.",
        },
        {
          label: "Suspend",
          icon: <ShieldOff className="h-4 w-4 mr-1.5" />,
          nextStatus: "SUSPENDED",
          variant: "outline",
          className: "text-orange-600 border-orange-300",
          description: "Lock out all users immediately. Can be reversed anytime.",
        },
        {
          label: "Cancel",
          icon: <XCircle className="h-4 w-4 mr-1.5" />,
          nextStatus: "CANCELLED",
          variant: "destructive",
          requireTypeName: true,
          description: "Begin 30-day data deletion grace period. Irreversible after purge.",
        },
      ];

    case "ACTIVE":
      return [
        {
          label: "Suspend (Freeze)",
          icon: <ShieldOff className="h-4 w-4 mr-1.5" />,
          nextStatus: "SUSPENDED",
          variant: "outline",
          className: "text-orange-600 border-orange-300",
          description: "Lock out all users immediately. Can be reversed anytime.",
        },
        {
          label: "Cancel",
          icon: <XCircle className="h-4 w-4 mr-1.5" />,
          nextStatus: "CANCELLED",
          variant: "destructive",
          requireTypeName: true,
          description: "Begin 30-day data deletion grace period. Irreversible after purge.",
        },
      ];

    case "SUSPENDED":
      return [
        {
          label: "Activate (Unfreeze)",
          icon: <ShieldCheck className="h-4 w-4 mr-1.5" />,
          nextStatus: "ACTIVE",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700",
          description: "Restore full access. Users can log in immediately.",
        },
        {
          label: "Cancel",
          icon: <XCircle className="h-4 w-4 mr-1.5" />,
          nextStatus: "CANCELLED",
          variant: "destructive",
          requireTypeName: true,
          description: "Begin 30-day data deletion grace period. Irreversible after purge.",
        },
      ];

    case "EXPIRED":
      return [
        {
          label: "Reactivate",
          icon: <RefreshCw className="h-4 w-4 mr-1.5" />,
          nextStatus: "ACTIVE",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700",
          description: "Restore access for this tenant. Extend their subscription manually.",
        },
        {
          label: "Cancel",
          icon: <XCircle className="h-4 w-4 mr-1.5" />,
          nextStatus: "CANCELLED",
          variant: "destructive",
          requireTypeName: true,
          description: "Begin 30-day data deletion grace period. Irreversible after purge.",
        },
      ];

    case "CANCELLED":
      return [
        {
          label: "Restore (Reactivate)",
          icon: <RefreshCw className="h-4 w-4 mr-1.5" />,
          nextStatus: "ACTIVE",
          variant: "default",
          className: "bg-green-600 hover:bg-green-700",
          description:
            "Restore this tenant to ACTIVE before the 30-day purge window closes. Once the cron purge runs, data is gone permanently.",
        },
      ];

    default:
      return [];
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: tenant, isLoading } = useTenant(id);
  const update = useUpdateTenant(id);
  const setStatus = useSetTenantStatus();
  const impersonate = useImpersonateTenant();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: StatusAction | null;
  }>({ open: false, action: null });

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    contactEmail: string;
    subscriptionTier: SubscriptionTier;
    maxBranches: number;
    maxStaff: number;
    notes: string;
  }>({
    name: "",
    contactEmail: "",
    subscriptionTier: "STARTER",
    maxBranches: 1,
    maxStaff: 10,
    notes: "",
  });

  const startEdit = () => {
    if (!tenant) return;
    setForm({
      name: tenant.name,
      contactEmail: tenant.contactEmail ?? "",
      subscriptionTier: tenant.subscriptionTier,
      maxBranches: tenant.maxBranches,
      maxStaff: tenant.maxStaff,
      notes: tenant.notes ?? "",
    });
    setEditing(true);
  };

  const handleTierChange = (newTier: SubscriptionTier) => {
    const limits = TIER_DEFAULTS[newTier];
    setForm((f) => ({
      ...f,
      subscriptionTier: newTier,
      maxBranches: limits.maxBranches,
      maxStaff: limits.maxStaff,
    }));
  };

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: () => {
        toast.success("Tenant updated");
        setEditing(false);
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleStatusConfirm = () => {
    if (!confirmDialog.action) return;
    setStatus.mutate(
      { id, status: confirmDialog.action.nextStatus },
      {
        onSuccess: () => {
          toast.success(`Tenant status → ${confirmDialog.action!.nextStatus}`);
          setConfirmDialog({ open: false, action: null });
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const handleImpersonate = () => {
    impersonate.mutate(id, {
      onSuccess: ({ token }) => {
        window.open(`/auth/impersonate?token=${encodeURIComponent(token)}`, "_blank");
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  if (isLoading)
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  if (!tenant)
    return <p className="text-center py-20 text-muted-foreground">Tenant not found</p>;

  const actions = getAvailableActions(tenant.status as TenantStatus);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/super-admin/tenants"><Button variant="ghost" size="sm" className="mt-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button></Link>

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <TenantStatusBadge status={tenant.status} />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{tenant.slug}</p>
        </div>

        {/* Impersonate always available */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleImpersonate}
          disabled={impersonate.isPending}
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Impersonate
        </Button>
      </div>

      {/* ── Status Control Panel ─────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold mb-1">Status Controls</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Current status:{" "}
          <strong className="text-foreground">{tenant.status}</strong>
          {tenant.status === "SUSPENDED" && " — all users are locked out"}
          {tenant.status === "TRIAL" && ` — trial ends ${tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : "?"}`}
          {tenant.status === "EXPIRED" && " — subscription expired, users locked out"}
          {tenant.status === "CANCELLED" && " — scheduled for purge after 30-day grace period"}
        </p>

        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.nextStatus}
              size="sm"
              variant={action.variant}
              className={action.className}
              onClick={() => setConfirmDialog({ open: true, action })}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>

        {/* State transition legend */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
          {(["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as TenantStatus[]).map(
            (s) => (
              <div key={s} className="flex items-center gap-1.5">
                <TenantStatusBadge status={s} />
                <span>
                  {s === "TRIAL" && "— within trial window"}
                  {s === "ACTIVE" && "— paying, full access"}
                  {s === "SUSPENDED" && "— frozen, locked out"}
                  {s === "EXPIRED" && "— trial/sub ended"}
                  {s === "CANCELLED" && "— queued for deletion"}
                </span>
              </div>
            )
          )}
        </div>
      </Card>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tier", value: tenant.subscriptionTier },
          { label: "Branches", value: `${tenant._count?.branches ?? 0} / ${tenant.maxBranches}` },
          { label: "Staff", value: `${tenant._count?.users ?? 0} / ${tenant.maxStaff}` },
          { label: "Created", value: new Date(tenant.createdAt).toLocaleDateString() },
          {
            label: "Trial Ends",
            value: tenant.trialEndsAt
              ? new Date(tenant.trialEndsAt).toLocaleDateString()
              : "—",
          },
          {
            label: "Expires",
            value: tenant.expiresAt ? new Date(tenant.expiresAt).toLocaleDateString() : "—",
          },
          { label: "Contact", value: tenant.contactEmail ?? "—" },
          {
            label: "Cancelled",
            value: tenant.cancelledAt
              ? new Date(tenant.cancelledAt).toLocaleDateString()
              : "—",
          },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-medium text-sm">{value}</p>
          </Card>
        ))}
      </div>

      {/* Edit panel */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Details</h2>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Subscription Tier</Label>
              <Select
                value={form.subscriptionTier}
                onValueChange={(v) => handleTierChange(v as SubscriptionTier)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter — 1 branch, up to 10 staff</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional — 5 branches, up to 50 staff</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise — Unlimited branches &amp; staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Branches (override)</Label>
              <Input
                type="number"
                min={1}
                value={form.maxBranches}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxBranches: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Staff (override)</Label>
              <Input
                type="number"
                min={1}
                value={form.maxStaff}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxStaff: Number(e.target.value) }))
                }
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Internal Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {tenant.notes ? (
              <p className="text-muted-foreground">{tenant.notes}</p>
            ) : (
              <p className="text-muted-foreground italic">No notes</p>
            )}
          </div>
        )}
      </Card>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
        title={confirmDialog.action?.label ?? ""}
        description={confirmDialog.action?.description ?? ""}
        confirmText={
          confirmDialog.action?.requireTypeName ? tenant.name : undefined
        }
        variant={confirmDialog.action?.variant === "destructive" ? "destructive" : "default"}
        confirmLabel={confirmDialog.action?.label ?? "Confirm"}
        isPending={setStatus.isPending}
        onConfirm={handleStatusConfirm}
      />
    </div>
  );
}

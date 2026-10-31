"use client";

import Link from "next/link";
import { Plus, Building2, CheckCircle, Clock, Ban, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/super-admin/MetricCard";
import { TenantStatusBadge } from "@/components/super-admin/TenantStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantStats, useTenants } from "@/hooks/use-super-admin";

export default function SuperAdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useTenantStats();
  const { data: recent } = useTenants({ page: 1 });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of all tenants on this instance</p>
        </div>
        <Link href="/super-admin/tenants/new"><Button>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button></Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <MetricCard label="Total" value={stats?.total ?? 0} icon={Building2} />
            <MetricCard label="Active" value={stats?.ACTIVE ?? 0} icon={CheckCircle} color="green" />
            <MetricCard label="Trial" value={stats?.TRIAL ?? 0} icon={Clock} color="blue" />
            <MetricCard label="Suspended" value={stats?.SUSPENDED ?? 0} icon={Ban} color="orange" />
            <MetricCard label="Expired" value={stats?.EXPIRED ?? 0} icon={AlertCircle} color="red" />
            <MetricCard label="Cancelled" value={stats?.CANCELLED ?? 0} icon={XCircle} color="gray" />
          </>
        )}
      </div>

      {/* Recent tenants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Tenants</h2>
          <Link href="/super-admin/tenants"><Button variant="outline" size="sm">View all</Button></Link>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent?.data.slice(0, 5).map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{t.slug ?? "—"}</td>
                  <td className="px-4 py-2.5"><TenantStatusBadge status={t.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.subscriptionTier}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/super-admin/tenants/${t.id}`}><Button variant="ghost" size="sm">View</Button></Link>
                  </td>
                </tr>
              ))}
              {!recent?.data.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No tenants yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

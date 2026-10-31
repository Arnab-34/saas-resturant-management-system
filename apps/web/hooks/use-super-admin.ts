"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type TenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CANCELLED";
export type SubscriptionTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface Tenant {
  id: string;
  name: string;
  slug: string | null;
  status: TenantStatus;
  subscriptionTier: SubscriptionTier;
  maxBranches: number;
  maxStaff: number;
  contactEmail: string | null;
  trialEndsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  notes: string | null;
  _count?: { branches: number; users: number };
}

export interface TenantStats {
  total: number;
  TRIAL: number;
  ACTIVE: number;
  SUSPENDED: number;
  EXPIRED: number;
  CANCELLED: number;
}

export interface PlatformConfig {
  defaultTrialDays: number;
  routingMode: string;
  cookieDomain: string | null;
  s3Bucket: string | null;
  s3Region: string | null;
  smtpConfigured: boolean;
}

export function useSuperAdminMe() {
  return useQuery({
    queryKey: ["super-admin", "me"],
    queryFn: () => api.get<{ id: string; email: string; name: string }>("/super-admin/auth/me"),
    retry: false,
  });
}

export function useSuperAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { email: string; password: string }) =>
      api.post<{ admin: { id: string; email: string; name: string } }>("/super-admin/auth/login", dto),
    onSuccess: (data) => { queryClient.setQueryData(["super-admin", "me"], data.admin); },
  });
}

export function useSuperAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/super-admin/auth/logout"),
    onSuccess: () => queryClient.clear(),
  });
}

export function useTenantStats() {
  return useQuery({
    queryKey: ["super-admin", "tenants", "stats"],
    queryFn: () => api.get<TenantStats>("/super-admin/tenants/stats"),
  });
}

export function useTenants(params?: { page?: number; status?: string }) {
  return useQuery({
    queryKey: ["super-admin", "tenants", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params?.page) q.set("page", String(params.page));
      if (params?.status) q.set("status", params.status);
      return api.get<{ data: Tenant[]; total: number; page: number; totalPages: number }>(
        `/super-admin/tenants?${q}`
      );
    },
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ["super-admin", "tenants", id],
    queryFn: () => api.get<Tenant>(`/super-admin/tenants/${id}`),
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; slug?: string; email: string; subscriptionTier?: SubscriptionTier; trialDays?: number; maxBranches?: number; maxStaff?: number; notes?: string }) =>
      api.post<{ restaurant: Tenant; invitationToken: string; invitationUrl: string }>("/super-admin/tenants", dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants"] }),
  });
}

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Record<string, unknown>) => api.patch<Tenant>(`/super-admin/tenants/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants", id] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants"] });
    },
  });
}

export function useSetTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: TenantStatus; reason?: string }) =>
      api.post<Tenant>(`/super-admin/tenants/${id}/status`, { status, reason }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants", id] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants"] });
    },
  });
}

export function useImpersonateTenant() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ token: string; tenantName: string }>(`/super-admin/tenants/${id}/impersonate`),
  });
}

export function usePlatformConfig() {
  return useQuery({
    queryKey: ["super-admin", "platform-config"],
    queryFn: () => api.get<PlatformConfig>("/super-admin/system/config"),
  });
}

export function useUpdatePlatformConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<PlatformConfig>) => api.patch<PlatformConfig>("/super-admin/system/config", dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "platform-config"] }),
  });
}

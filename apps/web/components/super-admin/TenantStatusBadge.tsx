import type { TenantStatus } from "@/hooks/use-super-admin";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TenantStatus, string> = {
  TRIAL: "bg-blue-100 text-blue-800 border-blue-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  SUSPENDED: "bg-orange-100 text-orange-800 border-orange-200",
  EXPIRED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

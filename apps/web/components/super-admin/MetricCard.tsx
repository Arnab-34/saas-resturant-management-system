import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  color?: "blue" | "green" | "orange" | "red" | "gray" | "default";
}

const COLOR_MAP: Record<NonNullable<MetricCardProps["color"]>, string> = {
  blue: "text-blue-600",
  green: "text-green-600",
  orange: "text-orange-600",
  red: "text-red-600",
  gray: "text-gray-500",
  default: "text-foreground",
};

export function MetricCard({ label, value, icon: Icon, color = "default" }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", COLOR_MAP[color])} />}
      </div>
      <p className={cn("mt-2 text-3xl font-bold", COLOR_MAP[color])}>{value}</p>
    </div>
  );
}

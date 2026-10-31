"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuperAdminLogout, useSuperAdminMe } from "@/hooks/use-super-admin";

const NAV = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenants", label: "Tenants", icon: Users },
  { href: "/super-admin/system", label: "System", icon: Settings },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, isLoading, isError } = useSuperAdminMe();
  const logout = useSuperAdminLogout();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/super-admin/login";

  useEffect(() => {
    if (!isLoginPage && !isLoading && (isError || !data)) {
      router.push("/super-admin/login");
    }
  }, [isLoading, isError, data, router, isLoginPage]);

  // Login page renders without the shell
  if (isLoginPage) return <>{children}</>;
  if (isLoading || !data) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size={28} className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
              Astrikcoders{" "}
              <span className="text-slate-400 font-normal">Platform Admin</span>
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">{data.email}</span>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-white/10"
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.push("/super-admin/login"),
              })
            }
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlatformConfig, useUpdatePlatformConfig } from "@/hooks/use-super-admin";

export default function SystemConfigPage() {
  const { data: config, isLoading } = usePlatformConfig();
  const update = useUpdatePlatformConfig();

  const [trialDays, setTrialDays] = useState(14);
  const [routingMode, setRoutingMode] = useState("BOTH");
  const [cookieDomain, setCookieDomain] = useState("");

  useEffect(() => {
    if (!config) return;
    setTrialDays(config.defaultTrialDays);
    setRoutingMode(config.routingMode);
    setCookieDomain(config.cookieDomain ?? "");
  }, [config]);

  const handleSave = () => {
    update.mutate(
      {
        defaultTrialDays: trialDays,
        routingMode,
        cookieDomain: cookieDomain || null,
      },
      {
        onSuccess: () => toast.success("Platform config saved"),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  if (isLoading)
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global configuration applied to all tenants on this instance.
        </p>
      </div>

      {/* Tenant Defaults */}
      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Tenant Defaults</h2>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="trialDays">Default Trial Period (days)</Label>
          <Input
            id="trialDays"
            type="number"
            min={0}
            max={365}
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Applied when creating a new tenant unless overridden per-tenant.
          </p>
        </div>
      </Card>

      {/* Routing */}
      <Card className="p-6 space-y-5">
        <h2 className="font-semibold">Tenant Login Routing</h2>

        <div className="space-y-1.5 max-w-xs">
          <Label>Routing Mode</Label>
          <Select value={routingMode} onValueChange={(val) => setRoutingMode(val ?? "BOTH")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QUERY_PARAM">
                Query Param — yourdomain.com/login?tenant=slug
              </SelectItem>
              <SelectItem value="SUBDOMAIN">
                Subdomain — slug.yourdomain.com
              </SelectItem>
              <SelectItem value="BOTH">Both (recommended)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(routingMode === "SUBDOMAIN" || routingMode === "BOTH") && (
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="cookieDomain">Cookie Domain</Label>
            <Input
              id="cookieDomain"
              value={cookieDomain}
              onChange={(e) => setCookieDomain(e.target.value)}
              placeholder=".yourdomain.com"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Leading dot required for cross-subdomain cookie sharing.
            </p>
          </div>
        )}
      </Card>

      {/* Local Upload Storage */}
      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Upload Storage</h2>
        <p className="text-sm text-muted-foreground">
          Uploads are stored on the local filesystem, namespaced per tenant under{" "}
          <code className="text-xs bg-muted px-1 rounded">
            UPLOADS_DIR/&#123;restaurantId&#125;/
          </code>
          . Set the <code className="text-xs bg-muted px-1 rounded">UPLOADS_DIR</code> environment
          variable to configure the base path (defaults to <code className="text-xs bg-muted px-1 rounded">./uploads</code>).
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ For horizontal scaling (multiple server instances), mount a shared NFS volume at <code className="bg-muted px-1 rounded">UPLOADS_DIR</code>.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

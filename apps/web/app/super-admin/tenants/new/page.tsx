"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTenant, type SubscriptionTier } from "@/hooks/use-super-admin";

const TIER_DEFAULTS: Record<SubscriptionTier, { maxBranches: number; maxStaff: number }> = {
  STARTER: { maxBranches: 1, maxStaff: 10 },
  PROFESSIONAL: { maxBranches: 5, maxStaff: 50 },
  ENTERPRISE: { maxBranches: 999, maxStaff: 9999 },
};

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export default function NewTenantPage() {
  const router = useRouter();
  const create = useCreateTenant();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<SubscriptionTier>("STARTER");
  const [trialDays, setTrialDays] = useState(14);
  const [maxBranches, setMaxBranches] = useState(1);
  const [maxStaff, setMaxStaff] = useState(10);
  const [notes, setNotes] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  // Auto-derive slug from name unless manually edited
  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name));
  }, [name, slugEdited]);

  // Auto-fill limits when tier changes
  useEffect(() => {
    const defaults = TIER_DEFAULTS[tier];
    setMaxBranches(defaults.maxBranches);
    setMaxStaff(defaults.maxStaff);
  }, [tier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, slug, email, subscriptionTier: tier, trialDays, maxBranches, maxStaff, notes: notes || undefined },
      {
        onSuccess: ({ restaurant, invitationUrl }) => {
          toast.success(`Tenant created! Invitation sent to ${email}`, { duration: 6000 });
          toast.info(`Invitation link: ${invitationUrl}`, { duration: 10000 });
          router.push(`/super-admin/tenants/${restaurant.id}`);
        },
        onError: (err) => toast.error((err as Error).message ?? "Failed to create tenant"),
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Tenant</h1>
        <p className="text-sm text-muted-foreground">
          Provision a new restaurant tenant. An invitation email will be sent to the owner.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Pizza Palace" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
                required
                placeholder="pizza-palace"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Used in login URL: ?tenant={slug || "…"}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Owner Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="owner@pizzapalace.com" />
            <p className="text-xs text-muted-foreground">Invitation link will be sent here.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Subscription Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as SubscriptionTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trialDays">Trial Days</Label>
              <Input id="trialDays" type="number" min={0} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxBranches">Max Branches</Label>
              <Input id="maxBranches" type="number" min={1} value={maxBranches} onChange={(e) => setMaxBranches(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxStaff">Max Staff Accounts</Label>
            <Input id="maxStaff" type="number" min={1} value={maxStaff} onChange={(e) => setMaxStaff(Number(e.target.value))} className="max-w-xs" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes visible only to super admin…" rows={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create Tenant"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

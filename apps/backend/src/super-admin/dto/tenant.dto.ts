// DTOs for tenant creation and update. Using plain classes rather than
// class-validator decorators to stay consistent with the rest of the codebase
// which uses Zod pipes on the router layer where needed.

export class CreateTenantDto {
  /** Display name of the restaurant/tenant */
  name: string;
  /** URL-safe slug, e.g. "pizza-palace" — auto-derived from name if omitted */
  slug?: string;
  /** Owner email — receives the invitation link */
  email: string;
  /** Subscription tier: STARTER | PROFESSIONAL | ENTERPRISE */
  subscriptionTier?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  /** Trial length in days; overrides PlatformConfig.defaultTrialDays */
  trialDays?: number;
  /** Max branches (override tier default) */
  maxBranches?: number;
  /** Max staff accounts (override tier default) */
  maxStaff?: number;
  /** Internal notes visible only to super admin */
  notes?: string;
}

export class UpdateTenantDto {
  name?: string;
  contactEmail?: string;
  subscriptionTier?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  maxBranches?: number;
  maxStaff?: number;
  expiresAt?: string; // ISO date string
  notes?: string;
}

export class SetTenantStatusDto {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  reason?: string;
}

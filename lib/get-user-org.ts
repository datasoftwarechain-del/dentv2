import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Organization, AuthUser } from "@/lib/types";

interface GetUserOrgOptions {
  /** If set, redirects to /dashboard if the org type doesn't match */
  requireType?: "dentist" | "lab";
  /** Custom redirect path if type check fails (default: /dashboard) */
  redirectOnFail?: string;
}

interface GetUserOrgResult {
  user: AuthUser;
  org: Organization;
}

/**
 * Server-side helper used in dashboard page components.
 * Fetches the current user and their primary organization.
 *
 * - Redirects to /auth/login if not authenticated
 * - Redirects to /onboarding if no system-account org found
 * - Redirects to /dashboard (or redirectOnFail) if requireType doesn't match
 *
 * Eliminates the ~20-line boilerplate that was duplicated across all dashboard pages.
 */
export const getUserOrg = cache(async function getUserOrgImpl(
  options?: GetUserOrgOptions
): Promise<GetUserOrgResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type, phone, address, is_system_account)")
    .eq("user_id", user.id);

  const orgs: Organization[] = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any): o is Organization => o && o.is_system_account !== false);

  const org = orgs[0] ?? null;

  if (!org) redirect("/onboarding");

  if (options?.requireType && org.type !== options.requireType) {
    redirect(options.redirectOnFail ?? "/dashboard");
  }

  return {
    user: user as AuthUser,
    org,
  };
});

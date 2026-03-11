import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Organization, AuthUser } from "@/lib/types";
import {
  type CollaboratorPermissions,
  normalizePermissions,
  isCollaboratorRole,
} from "@/lib/permissions";

interface GetUserOrgOptions {
  /** If set, redirects to /dashboard if the org type doesn't match */
  requireType?: "dentist" | "lab";
  /** Custom redirect path if type check fails (default: /dashboard) */
  redirectOnFail?: string;
}

interface GetUserOrgResult {
  user: AuthUser;
  org: Organization;
  /** The user's role in the organization */
  role: string;
  /**
   * Resolved permissions for the current user.
   * null = admin (full access, no restrictions).
   * CollaboratorPermissions = collaborator with explicit flags.
   */
  permissions: CollaboratorPermissions | null;
  /** True when the user is a collaborator (non-admin member) */
  isCollaborator: boolean;
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
 * Now also returns role, permissions, and isCollaborator for access control.
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
    .select("role, permissions, status, organization:org_id(id, name, type, phone, address, is_system_account)")
    .eq("user_id", user.id);

  // Find the primary org for this user.
  // Prefer non-preview orgs (lab/dentist) so that if a lab admin was somehow
  // linked to a preview org they don't land on the wrong org.
  // Fall back to any valid org (handles preview-only users like dentist_preview accounts).
  const mapped = (memberships || []).map((m: any) => {
    const orgData = m.organization;
    const org = Array.isArray(orgData) ? orgData[0] : orgData;
    return { org, role: m.role as string, permissions: m.permissions, status: m.status };
  });
  const membershipWithOrg =
    mapped.find(({ org }) => org && org.type !== "dentist_preview") ??
    mapped.find(({ org }) => Boolean(org));

  if (!membershipWithOrg) redirect("/onboarding");

  const { org, role, permissions: rawPerms, status } = membershipWithOrg;

  // Suspended collaborators get kicked out
  if (status === "suspended") redirect("/auth/login?error=suspended");

  if (options?.requireType && org.type !== options.requireType) {
    redirect(options.redirectOnFail ?? "/dashboard");
  }

  // Admins and regular members get full access (permissions = null)
  const resolvedRole = role ?? "member";
  const collaborator = isCollaboratorRole(resolvedRole);
  const resolvedPermissions: CollaboratorPermissions | null = collaborator
    ? normalizePermissions(rawPerms)
    : null;

  return {
    user: user as AuthUser,
    org,
    role: resolvedRole,
    permissions: resolvedPermissions,
    isCollaborator: collaborator,
  };
});

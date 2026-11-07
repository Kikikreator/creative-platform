export const APP_ROLES = ["admin", "instructor", "member"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type UserRoleRow = {
  role: string;
};

/**
 * Normalizes all role rows for one authenticated user.
 * A user may legitimately have more than one role.
 */
export function normalizeRoles(
  rows: readonly UserRoleRow[] | null | undefined
): AppRole[] {
  const allowed = new Set<string>(APP_ROLES);

  return Array.from(
    new Set(
      (rows ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => allowed.has(role))
    )
  );
}

export function hasRole(
  roles: readonly string[] | null | undefined,
  role: AppRole
): boolean {
  return Boolean(roles?.includes(role));
}

/**
 * Determines the only workspace an account may enter.
 * Priority is intentional: admin > instructor > member.
 * Therefore an instructor account that still has a legacy member row
 * cannot enter participant pages or use participant checkout flows.
 */
export function getPrimaryRole(
  roles: readonly string[] | null | undefined
): AppRole | null {
  if (hasRole(roles, "admin")) return "admin";
  if (hasRole(roles, "instructor")) return "instructor";
  if (hasRole(roles, "member")) return "member";
  return null;
}

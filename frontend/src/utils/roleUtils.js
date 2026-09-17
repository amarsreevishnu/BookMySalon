/**
 * Helper to determine the correct landing dashboard for any user based on role.
 * - ADMIN / is_superuser -> /admin/dashboard
 * - OWNER -> /owner/dashboard
 * - CUSTOMER (default) -> /customer-home
 */
export function getRoleDashboardPath(user) {
  if (!user) return "/login";

  if (user.role === "ADMIN" || user.is_superuser) {
    return "/admin/dashboard";
  }

  if (user.role === "OWNER") {
    return "/owner/dashboard";
  }

  return "/customer-home";
}


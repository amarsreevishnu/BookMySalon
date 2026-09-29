
export function getRoleDashboardPath(user) {
  if (!user) return "/login";

  if (user.role === "ADMIN" || user.is_superuser) {
    return "/admin/dashboard";
  }

  if (user.role === "OWNER") {
    return "/owner/dashboard";
  }

  if (user.role === "WORKER") {
    return "/worker/dashboard";
  }

  return "/customer-home";
}


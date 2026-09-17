import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleDashboardPath } from "../utils/roleUtils";

function RoleRoute({ allowedRoles = [] }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === "ADMIN" || Boolean(user.is_superuser);
  const isOwner = user.role === "OWNER";
  const isCustomer = user.role === "CUSTOMER" || (!isAdmin && !isOwner);

  let hasPermission = false;
  if (allowedRoles.includes("ADMIN") && isAdmin) {
    hasPermission = true;
  } else if (allowedRoles.includes("OWNER") && isOwner) {
    hasPermission = true;
  } else if (allowedRoles.includes("CUSTOMER") && isCustomer && !isAdmin) {
    hasPermission = true;
  }

  if (!hasPermission) {
    // Role-based access: redirect user directly to their designated dashboard
    const targetDashboard = getRoleDashboardPath(user);
    return <Navigate to={targetDashboard} replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
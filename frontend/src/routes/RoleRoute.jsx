import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getRoleDashboardPath } from "../utils/roleUtils";

function RoleRoute({ allowedRoles = [] }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === "ADMIN" || Boolean(user.is_superuser);
  const isOwner = user.role === "OWNER";
  const isWorker = user.role === "WORKER";
  const isCustomer = user.role === "CUSTOMER" || (!isAdmin && !isOwner && !isWorker);

  let hasPermission = false;
  if (allowedRoles.includes("ADMIN") && isAdmin) {
    hasPermission = true;
  } else if (allowedRoles.includes("OWNER") && isOwner) {
    hasPermission = true;
  } else if (allowedRoles.includes("WORKER") && isWorker) {
    hasPermission = true;
  } else if (allowedRoles.includes("CUSTOMER") && isCustomer && !isAdmin && !isWorker) {
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
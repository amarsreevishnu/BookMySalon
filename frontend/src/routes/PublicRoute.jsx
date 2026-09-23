import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getRoleDashboardPath } from "../utils/roleUtils";

function PublicRoute() {
  const { token, user } = useAuth();

  if (token) {
    const target = getRoleDashboardPath(user);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function PublicRoute() {
  const { token } = useAuth();

  if (token) {
    return <Navigate to="/customer-home" replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
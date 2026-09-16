import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function PrivateRoute() {
  const { token } = useAuth();
  const location = useLocation();

  console.log("PrivateRoute token:", token);
  console.log("PrivateRoute location:", location.pathname);

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

export default PrivateRoute;
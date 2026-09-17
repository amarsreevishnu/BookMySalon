import { Routes, Route } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import GoogleCallback from "../pages/GoogleCallback";
// import NotFound from "../pages/public/NotFound";

import CustomerHome from "../pages/CustomerHome";
// import Profile from "../pages/customer/Profile";

// import OwnerDashboard from "../pages/owner/OwnerDashboard";
// import CreateSalon from "../pages/owner/CreateSalon";

import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import RoleRoute from "./RoleRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/google-callback" element={<GoogleCallback />} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route path="/customer-home" element={<CustomerHome />} />
        {/* <Route path="/profile" element={<Profile />} /> */}
      </Route>

      {/* <Route element={<RoleRoute allowedRoles={["OWNER"]} />}> */}
        {/* <Route path="/owner-dashboard" element={<OwnerDashboard />} /> */}
        {/* <Route path="/owner/create-salon" element={<CreateSalon />} /> */}
      {/* </Route> */}

      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
}

export default AppRoutes;
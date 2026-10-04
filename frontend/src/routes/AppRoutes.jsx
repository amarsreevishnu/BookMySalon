import { Routes, Route } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import GoogleCallback from "../pages/GoogleCallback";
import NotFound from "../pages/NotFound";

import CustomerHome from "../pages/customer/CustomerHome";
import SalonsExplore from "../pages/customer/SalonsExplore";
import SalonDetail from "../pages/customer/SalonDetail";
import CustomerProfile from "../pages/customer/CustomerProfile";

import OwnerDashboard from "../pages/owner/OwnerDashboard";
import CreateSalon from "../pages/owner/CreateSalon";
import SalonProfileManagement from "../pages/owner/SalonProfileManagement";
import AddWorker from "../pages/owner/AddWorker";
import WorkerManagement from "../pages/owner/WorkerManagement";
import OwnerSchedule from "../pages/owner/OwnerSchedule";
import WorkerDashboard from "../pages/worker/WorkerDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminSalonsList from "../pages/admin/AdminSalonsList";
import AdminUserList from "../pages/admin/AdminUserList";
import AdminServicesList from "../pages/admin/AdminServicesList";
import WorkerCalendar from "../pages/worker/WorkerCalendar";

import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import RoleRoute from "./RoleRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/google-callback" element={<GoogleCallback />} />
      <Route path="/salon-application" element={<CreateSalon />} />      
      <Route path="/salons/:id" element={<SalonDetail />} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={["CUSTOMER"]} />}>
        <Route path="/customer-home" element={<CustomerHome />} />
        <Route path="/salons" element={<SalonsExplore />} />
        <Route path="/customer/salons" element={<SalonsExplore />} />
        <Route path="/customer/salons/:id" element={<SalonDetail />} />
        <Route path="/customer/profile" element={<CustomerProfile />} />
        <Route path="/profile" element={<CustomerProfile />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/salons" element={<AdminSalonsList />} />
        <Route path="/admin/users" element={<AdminUserList />} />
        <Route path="/admin/services" element={<AdminServicesList />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={["OWNER"]} />}>
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        
        <Route path="/owner/salon-profile" element={<SalonProfileManagement />} />
        <Route path="/owner/workers" element={<WorkerManagement />} />
        <Route path="/owner/schedule" element={<OwnerSchedule />} />
        <Route path="/owner/add-worker" element={<AddWorker />} />
        <Route path="/owner/workers/new" element={<AddWorker />} />
        <Route path="/owner/calendar" element={<WorkerCalendar />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={["WORKER"]} />}>
        <Route path="/worker/dashboard" element={<WorkerDashboard />} />
        <Route path="/worker" element={<WorkerDashboard />} />
        <Route path="/worker/calendar" element={<WorkerCalendar />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
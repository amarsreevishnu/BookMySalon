import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import lazyWithRetry from "../utils/lazyWithRetry";
import SalonLoader from "../components/common/Loader";

// Route guards (Synchronous - tiny and needed immediately for routing decisions)
import PublicRoute from "./PublicRoute";
import RoleRoute from "./RoleRoute";

// -----------------------------------------------------------------------------
// 1. Core & Public Authentication Routes (Lazy Loaded)
// -----------------------------------------------------------------------------
const LandingPage = lazyWithRetry(() => import("../pages/LandingPage"));
const Login = lazyWithRetry(() => import("../pages/Login"));
const Register = lazyWithRetry(() => import("../pages/Register"));
const ForgotPassword = lazyWithRetry(() => import("../pages/ForgotPassword"));
const GoogleCallback = lazyWithRetry(() => import("../pages/GoogleCallback"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));

// -----------------------------------------------------------------------------
// 2. Customer Portal Routes (Lazy Loaded)
// -----------------------------------------------------------------------------
const CustomerHome = lazyWithRetry(() => import("../pages/customer/CustomerHome"));
const SalonsExplore = lazyWithRetry(() => import("../pages/customer/SalonsExplore"));
const SalonDetail = lazyWithRetry(() => import("../pages/customer/SalonDetail"));
const CustomerProfile = lazyWithRetry(() => import("../pages/customer/CustomerProfile"));
const BookingPage = lazyWithRetry(() => import("../pages/customer/BookingPage"));
const MyBookings = lazyWithRetry(() => import("../pages/customer/MyBookings"));
const SavedSalons = lazyWithRetry(() => import("../pages/customer/SavedSalons"));
const CustomerWallet = lazyWithRetry(() => import("../pages/customer/CustomerWallet"));
const OffersPage = lazyWithRetry(() => import("../pages/customer/OffersPage"));

// -----------------------------------------------------------------------------
// 3. Salon Owner Portal Routes (Lazy Loaded)
// -----------------------------------------------------------------------------
const OwnerDashboard = lazyWithRetry(() => import("../pages/owner/OwnerDashboard"));
const OwnerBookings = lazyWithRetry(() => import("../pages/owner/OwnerBookings"));
const OwnerReviews = lazyWithRetry(() => import("../pages/owner/OwnerReviews"));
const OwnerRevenue = lazyWithRetry(() => import("../pages/owner/OwnerRevenue"));
const OwnerSettings = lazyWithRetry(() => import("../pages/owner/OwnerSettings"));
const CreateSalon = lazyWithRetry(() => import("../pages/owner/CreateSalon"));
const SalonProfileManagement = lazyWithRetry(() => import("../pages/owner/SalonProfileManagement"));
const AddWorker = lazyWithRetry(() => import("../pages/owner/AddWorker"));
const WorkerManagement = lazyWithRetry(() => import("../pages/owner/WorkerManagement"));
const OwnerSchedule = lazyWithRetry(() => import("../pages/owner/OwnerSchedule"));
const OwnerWorkerLeaves = lazyWithRetry(() => import("../pages/owner/OwnerWorkerLeaves"));
const OwnerServices = lazyWithRetry(() => import("../pages/owner/OwnerServices"));
const OwnerOffers = lazyWithRetry(() => import("../pages/owner/OwnerOffers"));
const OwnerSubscription = lazyWithRetry(() => import("../pages/owner/OwnerSubscription"));
const OwnerSupport = lazyWithRetry(() => import("../pages/owner/OwnerSupport"));

// -----------------------------------------------------------------------------
// 4. Specialist / Worker Portal Routes (Lazy Loaded)
// -----------------------------------------------------------------------------
const WorkerDashboard = lazyWithRetry(() => import("../pages/worker/WorkerDashboard"));
const WorkerLeave = lazyWithRetry(() => import("../pages/worker/WorkerLeave"));
const WorkerCalendar = lazyWithRetry(() => import("../pages/worker/WorkerCalendar"));
const WorkerProfile = lazyWithRetry(() => import("../pages/worker/WorkerProfile"));
const WorkerAppointmentDetail = lazyWithRetry(() => import("../pages/worker/WorkerAppointmentDetail"));

// -----------------------------------------------------------------------------
// 5. Super Admin Portal Routes (Lazy Loaded)
// -----------------------------------------------------------------------------
const AdminDashboard = lazyWithRetry(() => import("../pages/admin/AdminDashboard"));
const AdminProfile = lazyWithRetry(() => import("../pages/admin/AdminProfile"));
const AdminSalonsList = lazyWithRetry(() => import("../pages/admin/AdminSalonsList"));
const AdminUserList = lazyWithRetry(() => import("../pages/admin/AdminUserList"));
const AdminServicesList = lazyWithRetry(() => import("../pages/admin/AdminServicesList"));
const AdminSupport = lazyWithRetry(() => import("../pages/admin/AdminSupport"));
const AdminReviewsManagement = lazyWithRetry(() => import("../pages/admin/AdminReviewsManagement"));
const AdminOffersManagement = lazyWithRetry(() => import("../pages/admin/AdminOffersManagement"));
const AdminSubscriptionsManagement = lazyWithRetry(() => import("../pages/admin/AdminSubscriptionsManagement"));
const AdminBookingsManagement = lazyWithRetry(() => import("../pages/admin/AdminBookingsManagement"));
const AdminAnalyticsDashboard = lazyWithRetry(() => import("../pages/admin/AdminAnalyticsDashboard"));

function AppRoutes() {
  return (
    <Suspense fallback={<SalonLoader fullScreen label="Loading BookMySalon..." />}>
      <Routes>
        {/* Public & Onboarding Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/google-callback" element={<GoogleCallback />} />
        <Route path="/salon-application" element={<CreateSalon />} />
        <Route path="/owner/salons/create" element={<CreateSalon />} />

        {/* Public Auth Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Public Offers Explore */}
        <Route path="/offers" element={<OffersPage />} />

        {/* Customer Protected Routes */}
        <Route element={<RoleRoute allowedRoles={["CUSTOMER"]} />}>
          <Route path="/customer/home" element={<CustomerHome />} />
          <Route path="/customer/salons" element={<SalonsExplore />} />
          <Route path="/customer/salons/:id" element={<SalonDetail />} />
          <Route path="/customer/profile" element={<CustomerProfile />} />
          <Route path="/customer/salons/:id/book" element={<BookingPage />} />
          <Route path="/customer/my-bookings" element={<MyBookings />} />
          <Route path="/customer/wallet" element={<CustomerWallet />} />
          <Route path="/customer/saved-salons" element={<SavedSalons />} />
          <Route path="/customer/favorites" element={<SavedSalons />} />
          <Route path="/salons/:id" element={<SalonDetail />} />
          <Route path="/salons/:id/book" element={<BookingPage />} />
          <Route path="/customer/offers" element={<OffersPage />} />
        </Route>

        {/* Super Admin Protected Routes */}
        <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/profile" element={<AdminProfile />} />
          <Route path="/admin/salons" element={<AdminSalonsList />} />
          <Route path="/admin/users" element={<AdminUserList />} />
          <Route path="/admin/services" element={<AdminServicesList />} />
          <Route path="/admin/reviews" element={<AdminReviewsManagement />} />
          <Route path="/admin/offers" element={<AdminOffersManagement />} />
          <Route path="/admin/subscriptions" element={<AdminSubscriptionsManagement />} />
          <Route path="/admin/bookings" element={<AdminBookingsManagement />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsDashboard />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="/admin/tickets" element={<AdminSupport />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Salon Owner Protected Routes */}
        <Route element={<RoleRoute allowedRoles={["OWNER"]} />}>
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/bookings" element={<OwnerBookings />} />
          <Route path="/owner/reviews" element={<OwnerReviews />} />
          <Route path="/owner/revenue" element={<OwnerRevenue />} />
          <Route path="/owner/settings" element={<OwnerSettings />} />
          <Route path="/owner/salon-profile" element={<SalonProfileManagement />} />
          <Route path="/owner/services" element={<OwnerServices />} />
          <Route path="/owner/offers" element={<OwnerOffers />} />
          <Route path="/owner/subscription" element={<OwnerSubscription />} />
          <Route path="/owner/support" element={<OwnerSupport />} />
          <Route path="/owner/tickets" element={<OwnerSupport />} />
          <Route path="/owner/workers" element={<WorkerManagement />} />
          <Route path="/owner/schedule" element={<OwnerSchedule />} />
          <Route path="/owner/worker-leaves" element={<OwnerWorkerLeaves />} />
          <Route path="/owner/leaves" element={<OwnerWorkerLeaves />} />
          <Route path="/owner/add-worker" element={<AddWorker />} />
          <Route path="/owner/workers/new" element={<AddWorker />} />
          <Route path="/owner/calendar" element={<WorkerCalendar />} />
        </Route>

        {/* Specialist / Worker Protected Routes */}
        <Route element={<RoleRoute allowedRoles={["WORKER"]} />}>
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker" element={<WorkerDashboard />} />
          <Route path="/worker/calendar" element={<WorkerCalendar />} />
          <Route path="/worker/leave" element={<WorkerLeave />} />
          <Route path="/worker/leaves" element={<WorkerLeave />} />
          <Route path="/worker/profile" element={<WorkerProfile />} />
          <Route path="/worker/revenue" element={<WorkerDashboard />} />
          <Route path="/worker/appointments" element={<WorkerDashboard />} />
          <Route path="/worker/appointments/:id" element={<WorkerAppointmentDetail />} />
        </Route>

        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;

import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerBookingsTab from "../../components/owner/OwnerBookingsTab";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerDashboard.css";

export default function OwnerBookings() {
  const [salonInfo, setSalonInfo] = useState({ id: null, name: "Salon Studio", city: "" });
  const [bookings, setBookings] = useState([]);
  const [workersList, setWorkersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [workerFilter, setWorkerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Salon-level statistics from backend
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    pending: 0,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial fetch for workers and salon info
  useEffect(() => {
    const fetchInitialMeta = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const [dashRes, workersRes] = await Promise.allSettled([
          api.get("/salons/owner/dashboard/", config),
          api.get("/salons/owner/workers/", config),
        ]);
        if (dashRes.status === "fulfilled" && dashRes.value?.data?.salon_info) {
          setSalonInfo(dashRes.value.data.salon_info);
        }
        if (workersRes.status === "fulfilled" && workersRes.value?.data) {
          const wData = workersRes.value.data;
          const wList = Array.isArray(wData) ? wData : wData.results || wData.workers || [];
          setWorkersList(wList);
        }
      } catch (err) {
        console.error("Failed to load salon info / workers:", err);
      }
    };
    fetchInitialMeta();
  }, []);

  // Fetch paginated bookings from backend
  const fetchBookingsData = useCallback(async (page = currentPage, overrideFilters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const params = new URLSearchParams();
      params.append("page", page);
      const curPageSize = overrideFilters.pageSize !== undefined ? overrideFilters.pageSize : pageSize;
      params.append("page_size", curPageSize);

      const wFilter = overrideFilters.workerFilter !== undefined ? overrideFilters.workerFilter : workerFilter;
      if (wFilter && wFilter !== "all") params.append("worker_id", wFilter);

      const sFilter = overrideFilters.statusFilter !== undefined ? overrideFilters.statusFilter : statusFilter;
      if (sFilter && sFilter !== "all") params.append("status", sFilter);

      const pmFilter = overrideFilters.paymentMethodFilter !== undefined ? overrideFilters.paymentMethodFilter : paymentMethodFilter;
      if (pmFilter && pmFilter !== "all") params.append("payment_method", pmFilter);

      const dFilter = overrideFilters.dateFilter !== undefined ? overrideFilters.dateFilter : dateFilter;
      if (dFilter && dFilter !== "all") params.append("date", dFilter);

      const sQuery = overrideFilters.searchQuery !== undefined ? overrideFilters.searchQuery : debouncedSearch;
      if (sQuery && sQuery.trim()) params.append("search", sQuery.trim());

      const res = await api.get(`/salons/owner/bookings/?${params.toString()}`, config);
      if (res.data) {
        const d = res.data;
        const bList = Array.isArray(d.bookings) ? d.bookings : Array.isArray(d.results) ? d.results : [];
        setBookings(bList);
        setTotalCount(d.total_count !== undefined ? d.total_count : d.count !== undefined ? d.count : bList.length);
        setTotalPages(d.total_pages || 1);
        setCurrentPage(d.current_page || page);
        if (d.stats || d.counts) {
          const s = d.stats || d.counts;
          setStats({
            total: s.total ?? 0,
            confirmed: s.confirmed ?? 0,
            inProgress: s.in_progress ?? s.inProgress ?? 0,
            completed: s.completed ?? 0,
            cancelled: s.cancelled ?? 0,
            pending: s.pending ?? 0,
          });
        }
        if (d.salon_info && (!salonInfo.id || salonInfo.name === "Salon Studio")) {
          setSalonInfo(d.salon_info);
        }
      }
    } catch (err) {
      console.error("Failed to load owner bookings data:", err);
      showToast("Failed to refresh bookings");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, workerFilter, statusFilter, paymentMethodFilter, dateFilter, debouncedSearch, salonInfo.id, salonInfo.name]);

  // Re-fetch whenever pagination or active filters change
  useEffect(() => {
    fetchBookingsData(currentPage);
  }, [currentPage, pageSize, workerFilter, statusFilter, paymentMethodFilter, dateFilter, debouncedSearch]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleWorkerFilterChange = (val) => {
    setWorkerFilter(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handlePaymentMethodFilterChange = (val) => {
    setPaymentMethodFilter(val);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (val) => {
    setDateFilter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setWorkerFilter("all");
    setStatusFilter("all");
    setPaymentMethodFilter("all");
    setDateFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus, extraData = {}) => {
    try {
      await api.patch(`/salons/owner/bookings/${bookingId}/status/`, {
        status: newStatus,
        ...extraData,
      });
      showToast(`Booking #${bookingId} status updated to ${newStatus}!`);
      await fetchBookingsData(currentPage);
    } catch (err) {
      console.error("Failed to update booking status:", err);
      showToast(err.response?.data?.error || "Failed to update appointment status");
    }
  };

  return (
    <div className="studio-app-shell">
      <OwnerNavbarHeader salonInfo={salonInfo} />
      <OwnerNavbar activeTab="Bookings" workersCount={workersList.length} />

      <main className="studio-main-body">
        <OwnerBookingsTab
          bookings={bookings}
          workers={workersList}
          onUpdateStatus={handleUpdateBookingStatus}
          onRefresh={() => fetchBookingsData(currentPage)}
          isLoading={loading}
          pagination={{
            currentPage,
            totalPages,
            totalCount,
            pageSize,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
          backendFilters={{
            workerFilter,
            setWorkerFilter: handleWorkerFilterChange,
            statusFilter,
            setStatusFilter: handleStatusFilterChange,
            paymentMethodFilter,
            setPaymentMethodFilter: handlePaymentMethodFilterChange,
            dateFilter,
            setDateFilter: handleDateFilterChange,
            searchQuery,
            setSearchQuery: handleSearchChange,
            onResetFilters: handleResetFilters,
          }}
          backendStats={stats}
        />
      </main>

      {toastMessage && (
        <div className="studio-toast" style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "#1e392a",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 10,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          zIndex: 9999,
          fontSize: 13.5,
          fontWeight: 600,
        }}>
          {toastMessage}
        </div>
      )}

      <OwnerStickyFooter salonInfo={salonInfo} />
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerReviewsTab from "../../components/owner/OwnerReviewsTab";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerDashboard.css";

export default function OwnerReviews() {
  const navigate = useNavigate();
  const [salonInfo, setSalonInfo] = useState({ id: null, name: "Salon Studio", city: "" });
  const [reviews, setReviews] = useState([]);
  const [workerReviews, setWorkerReviews] = useState([]);
  const [rating, setRating] = useState(5.0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState(null);
  const [workersList, setWorkersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviewsData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const [dashRes, workersRes] = await Promise.allSettled([
        api.get("/salons/owner/dashboard/", config),
        api.get("/salons/owner/workers/", config),
      ]);

      if (dashRes.status === "fulfilled" && dashRes.value?.data) {
        const d = dashRes.value.data;
        if (d.salon_info) setSalonInfo(d.salon_info);
        if (Array.isArray(d.reviews)) setReviews(d.reviews);
        if (Array.isArray(d.worker_reviews)) setWorkerReviews(d.worker_reviews);
        setRating(typeof d.rating === "number" ? d.rating : parseFloat(d.rating) || 5.0);
        setReviewsCount(typeof d.reviews_count === "number" ? d.reviews_count : parseInt(d.reviews_count, 10) || 0);
        if (d.rating_breakdown) setRatingBreakdown(d.rating_breakdown);
      }

      if (workersRes.status === "fulfilled" && workersRes.value?.data) {
        const wData = workersRes.value.data;
        const wList = Array.isArray(wData) ? wData : wData.results || wData.workers || [];
        setWorkersList(wList);
      }
    } catch (err) {
      console.error("Failed to load reviews data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviewsData();
  }, [fetchReviewsData]);

  return (
    <div className="studio-app-shell">
      <OwnerNavbarHeader salonInfo={salonInfo} />
      <OwnerNavbar activeTab="Reviews" workersCount={workersList.length} />

      <main className="studio-main-body">
        <OwnerReviewsTab
          reviews={reviews}
          workerReviews={workerReviews}
          rating={rating}
          reviewsCount={reviewsCount}
          ratingBreakdown={ratingBreakdown}
          workers={workersList}
          onRefresh={fetchReviewsData}
          onBackToDashboard={() => navigate("/owner/dashboard")}
          isLoading={loading}
        />
      </main>

      <OwnerStickyFooter salonInfo={salonInfo} rating={rating} reviewsCount={reviewsCount} />
    </div>
  );
}

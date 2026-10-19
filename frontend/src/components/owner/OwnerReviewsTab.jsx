import { useState, useMemo } from "react";

export default function OwnerReviewsTab({
  reviews = [],
  workerReviews = [],
  rating = 5.0,
  reviewsCount = 0,
  ratingBreakdown = null,
  workers = [],
  onRefresh,
  onBackToDashboard,
  isLoading = false,
}) {
  const [activeReviewType, setActiveReviewType] = useState("salon"); // "salon" | "worker"
  const [selectedStar, setSelectedStar] = useState("all"); // "all" | 5 | 4 | 3 | 2 | 1
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("all");

  // Computed Salon Reviews
  const filteredSalonReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (selectedStar !== "all" && r.rating !== Number(selectedStar)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.customer_name || r.author || "").toLowerCase().includes(q);
        const matchesComment = (r.comment || "").toLowerCase().includes(q);
        const matchesTreatment = (r.treatment || "").toLowerCase().includes(q);
        if (!matchesName && !matchesComment && !matchesTreatment) return false;
      }
      return true;
    });
  }, [reviews, selectedStar, searchQuery]);

  // Computed Worker Reviews
  const filteredWorkerReviews = useMemo(() => {
    return workerReviews.filter((r) => {
      if (selectedStar !== "all" && r.rating !== Number(selectedStar)) {
        return false;
      }
      if (selectedWorkerId !== "all" && String(r.worker_id) !== String(selectedWorkerId)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.customer_name || r.author || "").toLowerCase().includes(q);
        const matchesWorker = (r.worker_name || "").toLowerCase().includes(q);
        const matchesComment = (r.comment || "").toLowerCase().includes(q);
        const matchesTreatment = (r.treatment || "").toLowerCase().includes(q);
        if (!matchesName && !matchesWorker && !matchesComment && !matchesTreatment) return false;
      }
      return true;
    });
  }, [workerReviews, selectedStar, selectedWorkerId, searchQuery]);

  // Active list based on toggle
  const activeList = activeReviewType === "salon" ? filteredSalonReviews : filteredWorkerReviews;

  // Breakdown percentages
  const breakdown = useMemo(() => {
    if (ratingBreakdown) return ratingBreakdown;
    const res = { 5: { count: 0, percentage: 0 }, 4: { count: 0, percentage: 0 }, 3: { count: 0, percentage: 0 }, 2: { count: 0, percentage: 0 }, 1: { count: 0, percentage: 0 } };
    if (!reviews || reviews.length === 0) return res;
    reviews.forEach((r) => {
      if (res[r.rating]) res[r.rating].count += 1;
    });
    const total = reviews.length;
    [5, 4, 3, 2, 1].forEach((star) => {
      res[star].percentage = Math.round((res[star].count / total) * 100);
    });
    return res;
  }, [ratingBreakdown, reviews]);

  const fiveStarRate = useMemo(() => {
    if (!reviews || reviews.length === 0) return 100;
    const count5 = reviews.filter((r) => r.rating === 5).length;
    return Math.round((count5 / reviews.length) * 100);
  }, [reviews]);

  return (
    <div className="studio-bookings-tab-container" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", background: "#ffffff", padding: "20px 24px", borderRadius: "14px", border: "1px solid var(--studio-border, #e8edea)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>⭐</span>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#1e392a" }}>Customer Reviews &amp; Quality Ratings</h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#627267", fontSize: "14px" }}>
            Real-time verified client feedback from completed bookings, rating breakdown, and individual staff performance.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#f0f4f1",
                color: "#1e392a",
                border: "1px solid #d4ded7",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span>{isLoading ? "⏳" : "🔄"}</span>
              <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
            </button>
          )}

          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#1e392a",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Rating Stats & Breakdown Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {/* Left Card: Overall Salon Score */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "14px", border: "1px solid #e8edea", display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "120px", padding: "16px", background: "#f8faf9", borderRadius: "12px", border: "1px solid #e8edea" }}>
            <span style={{ fontSize: "40px", fontWeight: 900, color: "#1e392a", lineHeight: 1 }}>{rating}</span>
            <div style={{ color: "#f59e0b", fontSize: "18px", margin: "6px 0 2px" }}>★★★★★</div>
            <span style={{ fontSize: "12px", color: "#627267", fontWeight: 600 }}>{reviewsCount} Verified Reviews</span>
          </div>

          <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const info = breakdown[star] || { count: 0, percentage: 0 };
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#627267" }}>
                  <span style={{ width: "42px", fontWeight: 600 }}>{star} ★</span>
                  <div style={{ flex: 1, height: "8px", background: "#f0f4f1", borderRadius: "99px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${info.percentage}%`,
                        background: star >= 4 ? "#1e824c" : star === 3 ? "#f59e0b" : "#c0392b",
                        borderRadius: "99px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <span style={{ width: "32px", textAlign: "right", fontWeight: 600, color: "#1e392a" }}>{info.percentage}%</span>
                  <span style={{ width: "30px", color: "#8a9990", textAlign: "right" }}>({info.count})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Quick Insights & Satisfaction */}
        <div style={{ background: "#ffffff", padding: "24px", borderRadius: "14px", border: "1px solid #e8edea", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ background: "#eaf7ef", padding: "16px", borderRadius: "12px", border: "1px solid #cce8d7" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e824c", textTransform: "uppercase", letterSpacing: "0.5px" }}>5-Star Satisfaction</span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#1e824c", margin: "4px 0" }}>{fiveStarRate}%</div>
            <span style={{ fontSize: "12px", color: "#2d6a4f" }}>of clients gave top score</span>
          </div>

          <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fef3c7" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.5px" }}>Staff Performance</span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#b45309", margin: "4px 0" }}>
              {workerReviews.length > 0 ? (workerReviews.reduce((acc, curr) => acc + curr.rating, 0) / workerReviews.length).toFixed(2) : rating}★
            </div>
            <span style={{ fontSize: "12px", color: "#92400e" }}>{workerReviews.length} specialist reviews</span>
          </div>

          <div style={{ background: "#f8faf9", padding: "16px", borderRadius: "12px", border: "1px solid #e8edea", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e392a" }}>Verified Completion Standard</h4>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#627267" }}>
                  Only clients who have completed an appointment can submit reviews. Exactly 1 review is permitted per booking.
                </p>
              </div>
              <span style={{ fontSize: "20px" }}>🛡️</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Toggle Controls */}
      <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "14px", border: "1px solid #e8edea", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Toggle between Salon Reviews and Specialist Reviews */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #f0f4f1", paddingBottom: "12px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setActiveReviewType("salon")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeReviewType === "salon" ? "#1e392a" : "#f0f4f1",
                color: activeReviewType === "salon" ? "#ffffff" : "#627267",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🏢</span>
              <span>Salon Reviews ({reviews.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReviewType("worker")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: activeReviewType === "worker" ? "#1e392a" : "#f0f4f1",
                color: activeReviewType === "worker" ? "#ffffff" : "#627267",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>✂️</span>
              <span>Specialist Reviews ({workerReviews.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 240px", maxWidth: "360px" }}>
            <input
              type="text"
              placeholder="Search by customer, service, comment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d4ded7",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Star Rating Pills & Worker Select */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#627267", marginRight: "4px" }}>Filter:</span>
            {["all", 5, 4, 3, 2, 1].map((s) => {
              const isSelected = selectedStar === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStar(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "99px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isSelected ? "1px solid #1e392a" : "1px solid #e0e6e2",
                    background: isSelected ? "#1e392a" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#1e392a",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  {s === "all" ? "All Stars" : `${s} ★`}
                </button>
              );
            })}
          </div>

          {activeReviewType === "worker" && workers && workers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#627267" }}>Specialist:</span>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #d4ded7",
                  fontSize: "12px",
                  fontWeight: 600,
                  outline: "none",
                  background: "#ffffff",
                }}
              >
                <option value="all">All Specialists</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name || w.name} ({w.specialization || "Stylist"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. Reviews List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {activeList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#ffffff", borderRadius: "14px", border: "1px solid #e8edea" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>💬</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#1e392a" }}>No Reviews Found</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#627267" }}>
              {searchQuery || selectedStar !== "all"
                ? "No reviews match your selected filter criteria. Try clearing search or selecting All Stars."
                : activeReviewType === "salon"
                ? "No verified salon reviews have been submitted yet. Completed customer bookings will appear here."
                : "No specialist reviews recorded yet for your team."}
            </p>
          </div>
        ) : (
          activeList.map((rev) => {
            const initial = (rev.customer_name || rev.author || "C")[0].toUpperCase();
            return (
              <div
                key={rev.id}
                style={{
                  background: "#ffffff",
                  padding: "18px 22px",
                  borderRadius: "14px",
                  border: "1px solid #e8edea",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                {/* Header row: Reviewer info + Stars */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {rev.avatar ? (
                      <img
                        src={rev.avatar}
                        alt={rev.author || rev.customer_name}
                        style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid #e8edea" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          background: "#eaf7ef",
                          color: "#1e824c",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "16px",
                          border: "1px solid #cce8d7",
                        }}
                      >
                        {initial}
                      </div>
                    )}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e392a" }}>
                          {rev.customer_name || rev.author || "Verified Customer"}
                        </h4>
                        <span style={{ fontSize: "11px", background: "#eaf7ef", color: "#1e824c", padding: "2px 8px", borderRadius: "99px", fontWeight: 700 }}>
                          ✓ Verified Booking
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", fontSize: "12px", color: "#627267" }}>
                        {rev.treatment && <span>Treatment: <strong>{rev.treatment}</strong></span>}
                        {rev.booking_id && <span>• Booking #{rev.booking_id}</span>}
                        {rev.worker_name && (
                          <span style={{ background: "#f0f4f1", color: "#1e392a", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                            Specialist: {rev.worker_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars & Date */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#f59e0b", fontSize: "16px", letterSpacing: "1px" }}>{"★".repeat(rev.rating)}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e392a" }}>{rev.rating}.0</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#8a9990" }}>{rev.date || (rev.created_at ? new Date(rev.created_at).toLocaleDateString() : "")}</span>
                  </div>
                </div>

                {/* Comment body */}
                {rev.comment ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#2d3748", lineHeight: 1.5, background: "#fbfcfb", padding: "10px 14px", borderRadius: "8px", border: "1px solid #f0f4f1", fontStyle: "italic" }}>
                    “{rev.comment}”
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "12px", color: "#8a9990", fontStyle: "italic" }}>
                    (Rating provided without written comment)
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


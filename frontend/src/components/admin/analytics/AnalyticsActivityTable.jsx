import { useState, useMemo } from "react";

export default function AnalyticsActivityTable({
  topSalons = [],
  activeCustomers = [],
  recentSalons = [],
  recentUsers = [],
  recentPayments = [],
  recentActions = [],
}) {
  const [activeTab, setActiveTab] = useState("top_salons");
  const [filterText, setFilterText] = useState("");

  const tabs = [
    { key: "top_salons", label: "Top Salons", icon: "🏪", count: topSalons.length },
    { key: "active_customers", label: "Active Customers", icon: "⭐", count: activeCustomers.length },
    { key: "recent_payments", label: "Subscription Payments", icon: "💳", count: recentPayments.length },
    { key: "recent_salons", label: "Recent Salons", icon: "📝", count: recentSalons.length },
    { key: "recent_users", label: "Recent Users", icon: "👥", count: recentUsers.length },
    { key: "recent_actions", label: "Admin History", icon: "📜", count: recentActions.length },
  ];

  // Filtered rows based on current active tab and filter text
  const filteredData = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    if (!q) {
      if (activeTab === "top_salons") return topSalons;
      if (activeTab === "active_customers") return activeCustomers;
      if (activeTab === "recent_salons") return recentSalons;
      if (activeTab === "recent_users") return recentUsers;
      if (activeTab === "recent_payments") return recentPayments;
      if (activeTab === "recent_actions") return recentActions;
      return [];
    }

    if (activeTab === "top_salons") {
      return topSalons.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "active_customers") {
      return activeCustomers.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "recent_salons") {
      return recentSalons.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.owner_email?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "recent_users") {
      return recentUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "recent_payments") {
      return recentPayments.filter(
        (p) =>
          p.payment_id?.toLowerCase().includes(q) ||
          p.salon_name?.toLowerCase().includes(q) ||
          p.plan_name?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "recent_actions") {
      return recentActions.filter(
        (a) =>
          a.salon_name?.toLowerCase().includes(q) ||
          a.action?.toLowerCase().includes(q) ||
          a.notes?.toLowerCase().includes(q)
      );
    }
    return [];
  }, [
    activeTab,
    filterText,
    topSalons,
    activeCustomers,
    recentSalons,
    recentUsers,
    recentPayments,
    recentActions,
  ]);

  return (
    <div className="analytics-activity-card">
      <div className="analytics-activity-header">
        <div>
          <h3 className="analytics-activity-title">Platform Activity & Performance Records</h3>
          <p className="analytics-activity-subtitle">
            Audited records across salons, subscribers, users, and billing transactions
          </p>
        </div>

        <div className="analytics-activity-search">
          <span className="analytics-search-icon">🔍</span>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter current table..."
            className="analytics-table-search-input"
          />
          {filterText && (
            <button
              type="button"
              className="analytics-search-clear"
              onClick={() => setFilterText("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="analytics-activity-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`analytics-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.key);
              setFilterText("");
            }}
          >
            <span className="analytics-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
            <span className="analytics-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table view */}
      <div className="analytics-table-wrapper">
        {filteredData.length === 0 ? (
          <div className="analytics-table-empty">
            <span className="analytics-table-empty-icon">📂</span>
            <p>No records found matching your filter criteria.</p>
          </div>
        ) : (
          <table className="analytics-table">
            {activeTab === "top_salons" && (
              <>
                <thead>
                  <tr>
                    <th># Rank</th>
                    <th>Salon Name</th>
                    <th>City</th>
                    <th>Total Bookings</th>
                    <th>Completed</th>
                    <th>Total Booking Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s, idx) => (
                    <tr key={`salon-${s.id || idx}`}>
                      <td>
                        <span className={`analytics-rank-badge rank-${idx + 1}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="bold-cell">{s.name}</td>
                      <td>📍 {s.city || "—"}</td>
                      <td>
                        <span className="analytics-count-pill">{s.booking_count}</span>
                      </td>
                      <td>
                        <span className="analytics-status-pill success">{s.completed_count}</span>
                      </td>
                      <td className="revenue-cell">
                        ₹{Number(s.revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === "active_customers" && (
              <>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer Name</th>
                    <th>Email Address</th>
                    <th>Bookings</th>
                    <th>Completed</th>
                    <th>Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((c, idx) => (
                    <tr key={`cust-${c.id || idx}`}>
                      <td>{idx + 1}</td>
                      <td className="bold-cell">{c.name || "Customer"}</td>
                      <td className="sub-cell">{c.email}</td>
                      <td>
                        <span className="analytics-count-pill">{c.booking_count}</span>
                      </td>
                      <td>
                        <span className="analytics-status-pill success">{c.completed_count}</span>
                      </td>
                      <td className="revenue-cell">
                        ₹{Number(c.total_spent || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === "recent_payments" && (
              <>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Salon</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((p, idx) => (
                    <tr key={`pay-${p.payment_id || idx}`}>
                      <td className="mono-cell">{p.payment_id || `TXN-${idx + 1}`}</td>
                      <td className="bold-cell">{p.salon_name}</td>
                      <td>
                        <span className="analytics-plan-badge">{p.plan_name}</span>
                      </td>
                      <td className="revenue-cell">
                        ₹{Number(p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span
                          className={`analytics-status-pill ${
                            p.status === "SUCCESS"
                              ? "success"
                              : p.status === "FAILED"
                              ? "danger"
                              : "warning"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="sub-cell">{p.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === "recent_salons" && (
              <>
                <thead>
                  <tr>
                    <th>Salon Name</th>
                    <th>Owner Contact</th>
                    <th>Location</th>
                    <th>Approval Status</th>
                    <th>Registered At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s, idx) => (
                    <tr key={`rec-salon-${s.id || idx}`}>
                      <td className="bold-cell">{s.name}</td>
                      <td className="sub-cell">{s.owner_email || "Applicant"}</td>
                      <td>📍 {s.city || "—"}</td>
                      <td>
                        <span
                          className={`analytics-status-pill ${
                            s.approval_status === "APPROVED"
                              ? "success"
                              : s.approval_status === "REJECTED"
                              ? "danger"
                              : "warning"
                          }`}
                        >
                          {s.approval_status}
                        </span>
                      </td>
                      <td className="sub-cell">{s.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === "recent_users" && (
              <>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((u, idx) => (
                    <tr key={`rec-user-${u.id || idx}`}>
                      <td className="bold-cell">{u.name}</td>
                      <td className="sub-cell">{u.email}</td>
                      <td>
                        <span className={`analytics-role-badge role-${u.role?.toLowerCase()}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`analytics-status-pill ${
                            u.is_active ? "success" : "danger"
                          }`}
                        >
                          {u.is_active ? "Active" : "Blocked"}
                        </span>
                      </td>
                      <td className="sub-cell">{u.date_joined}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === "recent_actions" && (
              <>
                <thead>
                  <tr>
                    <th>Salon</th>
                    <th>Action</th>
                    <th>Amount Paid</th>
                    <th>Notes</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((a, idx) => (
                    <tr key={`rec-act-${a.id || idx}`}>
                      <td className="bold-cell">{a.salon_name || "Platform"}</td>
                      <td>
                        <span className="analytics-action-pill">{a.action}</span>
                      </td>
                      <td className="revenue-cell">
                        {a.amount > 0 ? `₹${Number(a.amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="notes-cell">{a.notes || "—"}</td>
                      <td className="sub-cell">{a.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        )}
      </div>
    </div>
  );
}

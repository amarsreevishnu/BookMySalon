import { useState, useRef, useEffect } from "react";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "3m", label: "Last 3 Months" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
];

export default function AnalyticsFilterBar({
  timeframe,
  onSelectTimeframe,
  customRange,
  onApplyCustomRange,
  isRefreshing,
  onRefresh,
  onExport,
  periodMeta,
}) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState(customRange?.start || "");
  const [endDate, setEndDate] = useState(customRange?.end || "");
  const [dateError, setDateError] = useState("");
  const modalRef = useRef(null);

  // Sync state when customRange prop changes
  useEffect(() => {
    if (customRange?.start) setStartDate(customRange.start);
    if (customRange?.end) setEndDate(customRange.end);
  }, [customRange]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setShowCustomModal(false);
      }
    }
    if (showCustomModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCustomModal]);

  const handlePresetClick = (key) => {
    if (key === "custom") {
      setShowCustomModal(true);
    } else {
      setShowCustomModal(false);
      onSelectTimeframe(key);
    }
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setDateError("Both start and end dates are required");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError("");
    setShowCustomModal(false);
    onApplyCustomRange(startDate, endDate);
  };

  return (
    <div className="analytics-filter-bar">
      <div className="analytics-filter-left">
        <div className="analytics-presets-group" role="tablist" aria-label="Date Range Filter">
          {PRESETS.map((p) => {
            const isActive = timeframe === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`analytics-preset-btn ${isActive ? "active" : ""}`}
                onClick={() => handlePresetClick(p.key)}
              >
                {p.key === "custom" && customRange?.start && customRange?.end && timeframe === "custom"
                  ? `${customRange.start} → ${customRange.end}`
                  : p.label}
              </button>
            );
          })}
        </div>

        {periodMeta && (
          <div className="analytics-period-badge" title={periodMeta.period_label || ""}>
            <span className="analytics-period-dot" />
            <span className="analytics-period-dates">
              {periodMeta.start_date} – {periodMeta.end_date}
            </span>
            {periodMeta.period_label && (
              <span className="analytics-period-comp">({periodMeta.period_label})</span>
            )}
          </div>
        )}
      </div>

      <div className="analytics-filter-right">
        {onExport && (
          <button
            type="button"
            className="analytics-export-btn"
            onClick={onExport}
            title="Export analytics summary to CSV"
          >
            <span className="analytics-action-icon">📥</span>
            <span>Export CSV</span>
          </button>
        )}

        <button
          type="button"
          className="analytics-refresh-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh real-time analytics"
        >
          <span className={`analytics-refresh-icon ${isRefreshing ? "spinning" : ""}`}>🔄</span>
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Custom Date Range Popover/Modal */}
      {showCustomModal && (
        <div className="analytics-custom-modal-backdrop">
          <div className="analytics-custom-modal" ref={modalRef} role="dialog" aria-modal="true">
            <div className="analytics-custom-modal-header">
              <h3>Select Custom Date Range</h3>
              <button
                type="button"
                className="analytics-modal-close"
                onClick={() => setShowCustomModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyCustom} className="analytics-custom-form">
              <div className="analytics-form-row">
                <div className="analytics-form-field">
                  <label htmlFor="analytics-start-date">From Date</label>
                  <input
                    id="analytics-start-date"
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateError("");
                    }}
                    required
                  />
                </div>
                <div className="analytics-form-field">
                  <label htmlFor="analytics-end-date">To Date</label>
                  <input
                    id="analytics-end-date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateError("");
                    }}
                    required
                  />
                </div>
              </div>

              {dateError && <p className="analytics-form-error">{dateError}</p>}

              <div className="analytics-custom-modal-actions">
                <button
                  type="button"
                  className="analytics-modal-cancel-btn"
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="analytics-modal-apply-btn">
                  Apply Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";

/**
 * Pure SVG multi-segment Donut Chart
 * @param {Array} data - [{ label: 'Completed', count: 24, color: '#216a3e' }]
 * @param {string} centerLabel - Center text sub-label (default 'Total')
 * @param {number} size - Chart diameter in px (default 180)
 */
export default function AnalyticsDonutChart({
  data = [],
  centerLabel = "Total",
  size = 180,
  emptyMessage = "No distribution data",
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = useMemo(() => {
    return data.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
  }, [data]);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="analytics-donut-empty">
        <div className="analytics-donut-empty-ring" style={{ width: size, height: size }}>
          <span>0</span>
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Circle Geometry
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute segments
  let accumulatedOffset = 0;
  const segments = data.map((item, idx) => {
    const count = Number(item.count) || 0;
    const ratio = count / total;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += ratio * circumference;
    const percentage = ((count / total) * 100).toFixed(1);

    return {
      ...item,
      count,
      ratio,
      strokeDasharray,
      strokeDashoffset,
      percentage,
      index: idx,
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="analytics-donut-container">
      <div className="analytics-donut-svg-wrap" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="analytics-donut-svg"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#eef3f0"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((seg) => {
              const isHovered = hoveredIdx === seg.index;
              if (seg.count <= 0) return null;

              return (
                <circle
                  key={`slice-${seg.index}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color || "#216a3e"}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  onMouseEnter={() => setHoveredIdx(seg.index)}
                  style={{
                    cursor: "pointer",
                    transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                    opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                  }}
                />
              );
            })}
          </g>
        </svg>

        {/* Center Readout */}
        <div className="analytics-donut-center" pointerEvents="none">
          <span className="analytics-donut-center-val">
            {activeSegment ? activeSegment.count.toLocaleString("en-IN") : total.toLocaleString("en-IN")}
          </span>
          <span className="analytics-donut-center-lbl">
            {activeSegment ? `${activeSegment.percentage}%` : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="analytics-donut-legend">
        {segments.map((seg) => {
          const isHovered = hoveredIdx === seg.index;
          return (
            <div
              key={`legend-${seg.index}`}
              className={`analytics-donut-legend-item ${isHovered ? "active" : ""}`}
              onMouseEnter={() => setHoveredIdx(seg.index)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span
                className="analytics-donut-legend-dot"
                style={{ backgroundColor: seg.color || "#216a3e" }}
              />
              <span className="analytics-donut-legend-name" title={seg.label || seg.name}>
                {seg.label || seg.name}
              </span>
              <span className="analytics-donut-legend-count">
                {seg.count.toLocaleString("en-IN")}
              </span>
              <span className="analytics-donut-legend-pct">({seg.percentage}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

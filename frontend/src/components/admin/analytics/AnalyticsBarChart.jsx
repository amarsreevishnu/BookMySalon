import { useState } from "react";

/**
 * Pure SVG responsive Bar Chart
 * @param {Array} data - [{ label: 'Mon', count: 42, highlight: true }, ...]
 * @param {string} xKey - default 'label'
 * @param {string} yKey - default 'count'
 * @param {string} color - primary bar fill color (default '#216a3e')
 * @param {string} highlightColor - peak bar color (default '#16482a')
 * @param {string} unit - tooltip unit suffix (default 'bookings')
 * @param {number} height - chart height
 */
export default function AnalyticsBarChart({
  data = [],
  xKey = "label",
  yKey = "count",
  color = "#216a3e",
  highlightColor = "#0f2e1c",
  unit = "bookings",
  height = 240,
  emptyMessage = "No data available",
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="analytics-chart-empty" style={{ minHeight: height }}>
        <span className="analytics-empty-icon">📊</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const width = 640;
  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Max value calculation
  const totalCount = data.reduce((sum, d) => sum + (Number(d[yKey]) || 0), 0);
  let maxVal = Math.max(...data.map((d) => Number(d[yKey]) || 0), 0);
  if (maxVal === 0) maxVal = 5;

  const yTicksCount = 4;
  const step = Math.ceil(maxVal / yTicksCount);
  const yCeil = step * yTicksCount;

  const barCount = data.length;
  const slotWidth = innerWidth / barCount;
  const barWidth = Math.max(10, Math.min(36, slotWidth * 0.65));

  return (
    <div className="analytics-chart-container">
      <div className="analytics-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="analytics-svg"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Horizontal Gridlines */}
          {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
            const tickVal = Math.round((yCeil / yTicksCount) * (yTicksCount - i));
            const yPos = padding.top + (i / yTicksCount) * innerHeight;
            return (
              <g key={`y-grid-${i}`}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={width - padding.right}
                  y2={yPos}
                  stroke="#e6ede8"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const val = Number(d[yKey]) || 0;
            const barHeight = (val / yCeil) * innerHeight;
            const xSlot = padding.left + i * slotWidth;
            const xBar = xSlot + (slotWidth - barWidth) / 2;
            const yBar = padding.top + innerHeight - barHeight;
            const isHovered = hoveredIndex === i;
            const isPeak = val === maxVal && val > 0;

            return (
              <g
                key={`bar-${i}`}
                onMouseEnter={() => setHoveredIndex(i)}
                style={{ cursor: "pointer" }}
              >
                {/* Full slot hover target */}
                <rect
                  x={xSlot}
                  y={padding.top}
                  width={slotWidth}
                  height={innerHeight}
                  fill="transparent"
                />

                {/* Visible Column Bar */}
                <rect
                  x={xBar}
                  y={yBar}
                  width={barWidth}
                  height={Math.max(barHeight, val > 0 ? 2 : 0)}
                  rx="4"
                  ry="4"
                  fill={isHovered ? "#358a56" : isPeak ? highlightColor : color}
                  opacity={isHovered ? 1 : isPeak ? 1 : 0.85}
                  style={{
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transformOrigin: `center ${padding.top + innerHeight}px`,
                  }}
                />

                {/* X Axis Label */}
                <text
                  x={xSlot + slotWidth / 2}
                  y={padding.top + innerHeight + 18}
                  textAnchor="middle"
                  className={`analytics-axis-text ${isHovered ? "active" : ""}`}
                  style={{ fontWeight: isHovered || isPeak ? 600 : 400 }}
                >
                  {d[xKey]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="analytics-chart-tooltip"
            style={{
              left: `${
                ((padding.left + hoveredIndex * slotWidth + slotWidth / 2) / width) * 100
              }%`,
              top: `${padding.top}px`,
            }}
          >
            <div className="analytics-tooltip-title">{data[hoveredIndex][xKey]}</div>
            <div className="analytics-tooltip-row">
              <span className="analytics-tooltip-dot" style={{ backgroundColor: color }} />
              <span className="analytics-tooltip-label">Volume:</span>
              <span className="analytics-tooltip-val">
                {Number(data[hoveredIndex][yKey] || 0).toLocaleString("en-IN")} {unit}
              </span>
            </div>
            {totalCount > 0 && (
              <div className="analytics-tooltip-sub">
                {(
                  ((Number(data[hoveredIndex][yKey]) || 0) / totalCount) *
                  100
                ).toFixed(1)}
                % of total
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

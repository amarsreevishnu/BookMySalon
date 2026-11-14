import { useState, useId } from "react";

/**
 * Pure SVG responsive Line/Area Chart
 * @param {Array} data - Array of objects, e.g. [{ label: '10/24', value: 4500, value2: 300 }]
 * @param {string} xKey - Key for X axis label (e.g. 'label')
 * @param {Array} series - [{ key: 'value', label: 'Revenue', color: '#216a3e', prefix: '₹' }, ...]
 * @param {number} height - Chart height (default 260)
 */
export default function AnalyticsLineChart({
  data = [],
  xKey = "label",
  series = [{ key: "value", label: "Value", color: "#216a3e", prefix: "" }],
  height = 260,
  emptyMessage = "No trend data available for this range",
}) {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="analytics-chart-empty" style={{ minHeight: height }}>
        <span className="analytics-empty-icon">📈</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Dimensions & Padding
  const width = 700;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate Max Values
  let maxValue = 0;
  series.forEach((s) => {
    data.forEach((d) => {
      const val = Number(d[s.key] || 0);
      if (val > maxValue) maxValue = val;
    });
  });

  // Ensure minimum ceiling so 0 or tiny values render properly
  if (maxValue === 0) maxValue = 10;
  const yTicksCount = 4;
  const step = Math.ceil(maxValue / yTicksCount);
  const yCeil = step * yTicksCount;

  // Coordinate scales
  const getX = (index) => {
    if (data.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (data.length - 1)) * innerWidth;
  };

  const getY = (val) => {
    const safeVal = Math.max(0, Number(val) || 0);
    return padding.top + innerHeight - (safeVal / yCeil) * innerHeight;
  };

  // Build SVG path string with smooth bezier curve
  const buildPath = (key) => {
    if (data.length === 0) return "";
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d[key]) }));
    if (points.length === 1) {
      return `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  // Build area closed path
  const buildAreaPath = (key) => {
    const linePath = buildPath(key);
    if (!linePath) return "";
    const firstX = getX(0);
    const lastX = getX(data.length - 1);
    const bottomY = padding.top + innerHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Subsample X-labels if there are too many (e.g. > 10)
  const xStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="analytics-chart-container">
      {/* Chart Legend */}
      <div className="analytics-chart-legend">
        {series.map((s) => (
          <div key={s.key} className="analytics-legend-item">
            <span
              className="analytics-legend-dot"
              style={{ backgroundColor: s.color || "#216a3e" }}
            />
            <span className="analytics-legend-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="analytics-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="analytics-svg"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {series.map((s, idx) => (
              <linearGradient
                key={s.key}
                id={`${gradientId}-area-${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color || "#216a3e"} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color || "#216a3e"} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines & Y ticks */}
          {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
            const tickVal = Math.round((yCeil / yTicksCount) * (yTicksCount - i));
            const yPos = padding.top + (i / yTicksCount) * innerHeight;
            return (
              <g key={`y-grid-${i}`} className="analytics-grid-row">
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={width - padding.right}
                  y2={yPos}
                  stroke="#e2ebe5"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {series[0]?.prefix === "₹" && tickVal >= 1000
                    ? `₹${(tickVal / 1000).toFixed(tickVal % 1000 === 0 ? 0 : 1)}k`
                    : tickVal >= 1000
                    ? `${(tickVal / 1000).toFixed(1)}k`
                    : tickVal}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          {series.map((s, idx) => (
            <path
              key={`area-${s.key}`}
              d={buildAreaPath(s.key)}
              fill={`url(#${gradientId}-area-${idx})`}
            />
          ))}

          {/* Stroke Lines */}
          {series.map((s) => (
            <path
              key={`line-${s.key}`}
              d={buildPath(s.key)}
              fill="none"
              stroke={s.color || "#216a3e"}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Interactive Hover Guides & Dots */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <line
              x1={getX(hoveredIndex)}
              y1={padding.top}
              x2={getX(hoveredIndex)}
              y2={padding.top + innerHeight}
              stroke="#216a3e"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.75"
            />
          )}

          {/* Render points for hover target */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoveredIndex === i;

            return (
              <g key={`col-target-${i}`}>
                {/* Invisible wide hover area for smooth mouse tracking */}
                <rect
                  x={Math.max(0, x - (innerWidth / data.length) / 2)}
                  y={padding.top}
                  width={Math.max(20, innerWidth / data.length)}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  style={{ cursor: "pointer" }}
                />

                {/* Visible Dots for each series */}
                {series.map((s) => {
                  const y = getY(d[s.key]);
                  return (
                    <circle
                      key={`pt-${s.key}-${i}`}
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke={s.color || "#216a3e"}
                      strokeWidth={isHovered ? 3 : 2}
                      style={{ transition: "r 0.15s ease", pointerEvents: "none" }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            if (i % xStep !== 0 && i !== data.length - 1) return null;
            const x = getX(i);
            return (
              <text
                key={`x-lbl-${i}`}
                x={x}
                y={padding.top + innerHeight + 20}
                textAnchor="middle"
                className="analytics-axis-text"
              >
                {d[xKey]}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="analytics-chart-tooltip"
            style={{
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: `${padding.top + 10}px`,
            }}
          >
            <div className="analytics-tooltip-title">{data[hoveredIndex][xKey]}</div>
            {series.map((s) => (
              <div key={s.key} className="analytics-tooltip-row">
                <span
                  className="analytics-tooltip-dot"
                  style={{ backgroundColor: s.color || "#216a3e" }}
                />
                <span className="analytics-tooltip-label">{s.label}:</span>
                <span className="analytics-tooltip-val">
                  {s.prefix || ""}
                  {Number(data[hoveredIndex][s.key] || 0).toLocaleString("en-IN")}
                  {s.suffix || ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

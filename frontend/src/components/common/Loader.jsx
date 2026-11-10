import React from "react";
import defaultLogo from "../../assets/logo.png";
/**
 * LogoLoader (BookMySalon)
 * A loader built around your logo.
 *  - "orbit"  the logo breathes with a soft shine while a light-green arc
 *             circles it and pulse rings spread outward (default)
 *  - "fill"   the logo starts as a faded outline and fills with color from
 *             the bottom up, over and over
 *
 * No dependencies. Styles are injected by the component itself.
 *
 * Props:
 *  - logo        string   Path/URL of the logo image
 *                         (default "/bookmysalon_logo.png", so put the PNG in
 *                         your public folder, or import it and pass it in)
 *  - variant     "orbit" | "fill"   (default "orbit")
 *  - size        number   Logo size in px (default 120)
 *  - label       string   Optional text under the loader
 *  - fullScreen  boolean  Center on a full-page backdrop
 *
 * Usage:
 *  import logo from "./assets/bookmysalon_logo.png";
 *
 *  <LogoLoader logo={logo} />
 *  <LogoLoader logo={logo} variant="fill" label="Booking your slot" />
 *  <LogoLoader logo={logo} fullScreen label="Loading BookMySalon" />
 */

const CSS = `
.bm-root {
  --bm-deep: #01582e;
  --bm-lime: #8ff26b;
  --bm-mint: #f4fbf1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--bm-deep);
}
.bm-root.bm-full {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(244, 251, 241, 0.94);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.bm-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: calc(var(--bm-size) * 1.4);
  height: calc(var(--bm-size) * 1.4);
}
.bm-logo {
  position: relative;
  width: var(--bm-size);
  height: var(--bm-size);
  border-radius: 50%;
  overflow: hidden;
}
.bm-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* ---------- orbit ---------- */
.bm-orbit .bm-logo {
  animation: bm-breathe 2.4s ease-in-out infinite;
  box-shadow: 0 0 calc(var(--bm-size) * 0.3) color-mix(in srgb, var(--bm-lime) 45%, transparent);
}
.bm-orbit .bm-logo::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .5) 50%, transparent 65%);
  transform: translateX(-120%);
  animation: bm-sheen 2.4s ease-in-out infinite;
}
@keyframes bm-breathe {
  0%, 100% { transform: scale(.96); }
  50%      { transform: scale(1.03); }
}
@keyframes bm-sheen {
  0%, 35% { transform: translateX(-120%); }
  75%, 100% { transform: translateX(120%); }
}

.bm-spin {
  --bm-t: calc(var(--bm-size) * 0.035);
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0deg, transparent 120deg, var(--bm-lime) 350deg, var(--bm-deep) 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--bm-t)), #000 calc(100% - var(--bm-t) + 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - var(--bm-t)), #000 calc(100% - var(--bm-t) + 1px));
  animation: bm-rotate 1.5s linear infinite;
}
@keyframes bm-rotate { to { transform: rotate(360deg); } }

.bm-wave {
  position: absolute;
  width: var(--bm-size);
  height: var(--bm-size);
  border-radius: 50%;
  border: 2px solid var(--bm-lime);
  opacity: 0;
  animation: bm-wave 2.4s ease-out infinite;
}
.bm-wave.w2 { animation-delay: 1.2s; }
@keyframes bm-wave {
  0%   { transform: scale(1);    opacity: .6; }
  100% { transform: scale(1.38); opacity: 0; }
}

/* ---------- fill ---------- */
.bm-fill .bm-logo { position: relative; }
.bm-fill .bm-base { filter: grayscale(1); opacity: .16; }
.bm-fill .bm-color {
  position: absolute;
  inset: 0;
  animation: bm-reveal 3s ease-in-out infinite;
}
@keyframes bm-reveal {
  0%   { clip-path: inset(100% 0 0 0); opacity: 1; }
  65%  { clip-path: inset(0 0 0 0);    opacity: 1; }
  88%  { clip-path: inset(0 0 0 0);    opacity: 1; }
  100% { clip-path: inset(0 0 0 0);    opacity: 0; }
}
.bm-edge {
  position: absolute;
  left: 50%;
  width: var(--bm-size);
  height: 3px;
  margin-left: calc(var(--bm-size) * -0.5);
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--bm-lime), transparent);
  box-shadow: 0 0 12px var(--bm-lime);
  opacity: 0;
  animation: bm-edge 3s ease-in-out infinite;
}
@keyframes bm-edge {
  0%   { top: calc(50% + var(--bm-size) * 0.5); opacity: 1; }
  65%  { top: calc(50% - var(--bm-size) * 0.5); opacity: 1; }
  70%, 100% { top: calc(50% - var(--bm-size) * 0.5); opacity: 0; }
}

/* ---------- label ---------- */
.bm-label { font-size: 1rem; font-weight: 600; letter-spacing: .01em; }
.bm-dots { display: inline-flex; gap: 3px; margin-left: 5px; }
.bm-dots i {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--bm-lime);
  animation: bm-dot 1s ease-in-out infinite;
}
.bm-dots i:nth-child(2) { animation-delay: .15s; }
.bm-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes bm-dot {
  0%, 100% { transform: translateY(0); opacity: .4; }
  50%      { transform: translateY(-4px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .bm-logo, .bm-logo::after, .bm-wave, .bm-edge, .bm-dots i { animation: none; }
  .bm-spin { animation-duration: 4s; }
  .bm-fill .bm-color { animation: none; }
  .bm-wave, .bm-edge { display: none; }
}
`;

export default function SalonLoader({
  logo = defaultLogo || "/logo.png",
  variant = "orbit",
  size = 120,
  label,
  fullScreen = false,
}) {
  return (
    <div
      className={`bm-root${fullScreen ? " bm-full" : ""}`}
      style={{ "--bm-size": `${size}px` }}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
    >
      <style>{CSS}</style>

      {variant === "orbit" && (
        <div className="bm-stage bm-orbit" aria-hidden="true">
          <div className="bm-wave" />
          <div className="bm-wave w2" />
          <div className="bm-spin" />
          <div className="bm-logo">
            <img src={logo} alt="" draggable="false" />
          </div>
        </div>
      )}

      {variant === "fill" && (
        <div className="bm-stage bm-fill" aria-hidden="true">
          <div className="bm-logo">
            <img className="bm-base" src={logo} alt="" draggable="false" />
            <img className="bm-color" src={logo} alt="" draggable="false" />
          </div>
          <div className="bm-edge" />
        </div>
      )}

      {label && (
        <div className="bm-label">
          {label}
          <span className="bm-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
    </div>
  );
}
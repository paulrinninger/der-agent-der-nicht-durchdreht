"use client";

import { memo } from "react";

/**
 * 270° budget arc. used = ice gradient with glow, reserved = hatched segment
 * stacked behind it (the reserve→commit mechanic, visible), peak = warn tick.
 * pathLength=100 lets CSS transition stroke-dasharray directly.
 */

const ARC = "M 52.12 187.88 A 96 96 0 1 1 187.88 187.88"; // 135° → 45°, clockwise

function tickCoords(deg: number, r: number, len: number) {
  const a = (deg * Math.PI) / 180;
  return {
    x1: 120 + (r - len) * Math.cos(a),
    y1: 120 + (r - len) * Math.sin(a),
    x2: 120 + (r + len) * Math.cos(a),
    y2: 120 + (r + len) * Math.sin(a),
  };
}

export const Gauge = memo(function Gauge({
  usedPct,
  reservedPct,
  peakPct,
}: {
  usedPct: number;
  reservedPct: number;
  peakPct: number;
}) {
  const used = Math.min(100, Math.max(0, usedPct));
  const reserved = Math.min(100 - used, Math.max(0, reservedPct));
  const peak = Math.min(100, Math.max(0, peakPct));

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={`Budget ${used.toFixed(0)} % verbraucht`}>
      <defs>
        <linearGradient id="g-ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a5e0fc" />
          <stop offset="1" stopColor="#5db8e8" />
        </linearGradient>
        <pattern
          id="g-hatch"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <rect width="3" height="6" fill="rgba(125,211,252,0.45)" />
        </pattern>
      </defs>
      <path d={ARC} pathLength={100} className="gauge-track" fill="none" strokeWidth="14" strokeLinecap="round" />
      {/* reserved sits behind used, offset by the used arc — butt caps */}
      {reserved > 0.3 && (
        <path
          d={ARC}
          pathLength={100}
          className="gauge-reserved"
          fill="none"
          stroke="url(#g-hatch)"
          strokeWidth="14"
          strokeDasharray={`${reserved} 100`}
          strokeDashoffset={-used}
        />
      )}
      {used > 0.3 && (
        <path
          d={ARC}
          pathLength={100}
          className="gauge-used"
          fill="none"
          stroke="url(#g-ice)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${used} 100`}
        />
      )}
      {peak > 0.5 && <line className="gauge-peak" strokeWidth="2" {...tickCoords(135 + 2.7 * peak, 96, 11)} />}
    </svg>
  );
});

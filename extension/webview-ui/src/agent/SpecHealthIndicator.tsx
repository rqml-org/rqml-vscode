// Pie chart spec health indicator (0–1 progress)
import React from 'react';

interface SpecHealthIndicatorProps {
  progress: number; // 0 = no spec, 0.01–0.99 = stages, 1 = ready
  size?: number;
}

export const SpecHealthIndicator: React.FC<SpecHealthIndicatorProps> = ({
  progress,
  size = 16,
}) => {
  const r = size / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;

  // Clamp progress
  const p = Math.max(0, Math.min(1, progress));

  let fill: React.ReactNode;

  if (p === 0) {
    // Empty circle — no spec
    fill = null;
  } else if (p >= 1) {
    // Full circle — ready
    fill = <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
  } else {
    // Pie arc
    const angle = p * 2 * Math.PI;
    const x = cx + r * Math.sin(angle);
    const y = cy - r * Math.cos(angle);
    const largeArc = p > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`;
    fill = <path d={d} fill="currentColor" />;
  }

  return (
    <span className="spec-health" title={`Spec completeness: ${Math.round(p * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
        />
        {fill}
      </svg>
    </span>
  );
};

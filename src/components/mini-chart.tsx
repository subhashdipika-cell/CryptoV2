"use client";

export function MiniChart({ data, negative = false, height = 60 }: { data: number[]; negative?: boolean; height?: number }) {
  const width = 240;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const points = data.map((value, index) => `${(index / (data.length - 1)) * width},${height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4}`).join(" ");
  const color = negative ? "#ff5d72" : "#23f7b6";
  const fill = `M 0 ${height} L ${points.replaceAll(" ", " L ")} L ${width} ${height} Z`;
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Price trend">
    <defs><linearGradient id={`g-${negative}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".24"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <path d={fill} fill={`url(#g-${negative})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
  </svg>;
}

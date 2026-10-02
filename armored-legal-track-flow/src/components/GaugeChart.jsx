export default function GaugeChart({ value = 0, subLabel = "" }) {
  const clamped = Math.min(Math.max(value, 0), 100);

  // SVG dims: 220 wide x 130 tall, semicircle centered at (110, 115)
  const cx = 110, cy = 115;
  const rOuter = 90, rInner = 58, rNeedle = 82;

  // Angle: -180° (left, 0%) to 0° (right, 100%) — standard speedometer
  // In SVG coords: starts at left (π) and sweeps counterclockwise to right (0)
  const toRad = (pct) => Math.PI - (pct / 100) * Math.PI;

  const ptOuter = (pct) => ({
    x: cx + rOuter * Math.cos(toRad(pct)),
    y: cy - rOuter * Math.sin(toRad(pct)),
  });
  const ptInner = (pct) => ({
    x: cx + rInner * Math.cos(toRad(pct)),
    y: cy - rInner * Math.sin(toRad(pct)),
  });

  const segmentPath = (from, to) => {
    const o1 = ptOuter(from), o2 = ptOuter(to);
    const i1 = ptInner(to),   i2 = ptInner(from);
    const large = to - from > 50 ? 1 : 0;
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} 0 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${rInner} ${rInner} 0 ${large} 1 ${i2.x} ${i2.y}`,
      "Z",
    ].join(" ");
  };

  // Segments: red 0-33, amber 33-66, green 66-100
  const segments = [
    { from: 0,  to: 33,  color: "#ef4444" },
    { from: 33, to: 66,  color: "#f59e0b" },
    { from: 66, to: 100, color: "#10b981" },
  ];

  // Needle
  const needleRad = toRad(clamped);
  const nx = cx + rNeedle * Math.cos(needleRad);
  const ny = cy - rNeedle * Math.sin(needleRad);
  // Needle tail (short back end)
  const tailLen = 14;
  const tx = cx - tailLen * Math.cos(needleRad);
  const ty = cy + tailLen * Math.sin(needleRad);

  // Value color
  const valColor = clamped >= 66 ? "#10b981" : clamped >= 33 ? "#d97706" : "#ef4444";

  // Tick marks
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const rTickOuter = rOuter + 6;
  const rTickInner = rOuter + 1;
  const rLabel = rOuter + 16;

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 220 140" className="w-full max-w-[260px]">
        {/* Background arc (track) */}
        <path d={segmentPath(0, 100)} fill="#e2e8f0" />

        {/* Colored segments */}
        {segments.map((s) => (
          <path key={s.from} d={segmentPath(s.from, s.to)} fill={s.color} opacity="0.9" />
        ))}

        {/* Tick marks */}
        {ticks.map((t) => {
          const rad = toRad(t);
          const isMajor = t % 20 === 0;
          const ro = isMajor ? rTickOuter + 2 : rTickOuter;
          const ri = rTickInner;
          const x1 = cx + ro * Math.cos(rad);
          const y1 = cy - ro * Math.sin(rad);
          const x2 = cx + ri * Math.cos(rad);
          const y2 = cy - ri * Math.sin(rad);
          return (
            <line key={t} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="white" strokeWidth={isMajor ? 2 : 1} strokeLinecap="round" />
          );
        })}

        {/* Scale labels: 0%, 50%, 100% */}
        {[0, 50, 100].map((t) => {
          const rad = toRad(t);
          const lx = cx + rLabel * Math.cos(rad);
          const ly = cy - rLabel * Math.sin(rad);
          return (
            <text key={t} x={lx} y={ly + 3} textAnchor="middle"
              fontSize="8" fill="#64748b" fontFamily="monospace" fontWeight="600">
              {t}%
            </text>
          );
        })}

        {/* Needle shadow */}
        <line x1={tx + 0.5} y1={ty + 0.5} x2={nx + 0.5} y2={ny + 0.5}
          stroke="rgba(0,0,0,0.15)" strokeWidth="3" strokeLinecap="round" />
        {/* Needle */}
        <line x1={tx} y1={ty} x2={nx} y2={ny}
          stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" />
        {/* Pivot center */}
        <circle cx={cx} cy={cy} r="7" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="3.5" fill="#f1f5f9" />

        {/* Value readout */}
        <text x={cx} y={cy + 24} textAnchor="middle"
          fontSize="20" fontWeight="800" fill={valColor} fontFamily="monospace">
          {clamped.toFixed(1)}%
        </text>
      </svg>

      {subLabel && (
        <p className="text-[10px] text-gray-400 text-center mt-1 px-4">{subLabel}</p>
      )}
    </div>
  );
}
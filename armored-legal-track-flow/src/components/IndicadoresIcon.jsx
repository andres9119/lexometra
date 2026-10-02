export default function IndicadoresIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      {/* Gauge/Speedometer */}
      <circle cx="12" cy="10" r="7" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="12" cy="10" r="5.5" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
      
      {/* Gauge marks */}
      <line x1="12" y1="3.5" x2="12" y2="2.5" stroke="#3b82f6" strokeWidth="1" />
      <line x1="17.5" y1="10" x2="18.5" y2="10" stroke="#3b82f6" strokeWidth="1" />
      <line x1="15.5" y1="4.5" x2="16.3" y2="3.7" stroke="#3b82f6" strokeWidth="0.8" opacity="0.7" />
      
      {/* Needle */}
      <line x1="12" y1="10" x2="15" y2="6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="10" r="1.5" fill="#3b82f6" />
      
      {/* Bar chart below */}
      <rect x="6" y="15" width="2" height="5" fill="#3b82f6" rx="0.5" />
      <rect x="9" y="13" width="2" height="7" fill="#3b82f6" rx="0.5" />
      <rect x="12" y="14" width="2" height="6" fill="#3b82f6" rx="0.5" />
      <rect x="15" y="12" width="2" height="8" fill="#3b82f6" rx="0.5" />
      
      {/* Magnifying glass frame (optional accent) */}
      <circle cx="18" cy="19" r="3" stroke="#3b82f6" strokeWidth="1.2" fill="none" />
      <line x1="20.5" y1="21.5" x2="22" y2="23" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
export function Lbl({ children, error }) {
  return (
    <div className={`bg-gray-200 border-r border-b border-gray-400 px-2 flex items-center min-h-[30px] ${error ? "bg-red-100" : ""}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${error ? "text-red-700" : "text-gray-700"}`}>{children}</span>
    </div>
  );
}

export function Val({ children, span = 1, className = "" }) {
  return (
    <div className={`bg-white border-r border-b border-gray-400 flex items-center min-h-[30px] col-span-${span} ${className}`}>
      {children}
    </div>
  );
}
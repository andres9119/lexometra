const CONDITIONS = [
  { field: "victim_conflict",     label: "Víctima del conflicto" },
  { field: "indigenous",          label: "Indígena" },
  { field: "elderly",             label: "Adulto mayor" },
  { field: "psychological_impact",label: "Afectación psicológica" },
  { field: "single_mother",       label: "Madre cabeza de familia" },
];

/**
 * Modo FORMULARIO (mode="edit"):
 *   - Muestra todas las píldoras como toggles interactivos.
 *   - `values`: objeto { field: "si"|"no"|"" }
 *   - `onChange(field, newValue)`: callback al hacer clic.
 *
 * Modo LECTURA (mode="read"):
 *   - Solo muestra las condiciones con valor "si" como badges estáticos.
 *   - `values`: objeto con los datos del cliente.
 */
export default function CondicionesEspeciales({ mode = "read", values = {}, onChange }) {
  if (mode === "edit") {
    return (
      <div className="flex flex-wrap gap-2">
        {CONDITIONS.map(({ field, label }) => {
          const active = values[field] === "si";
          return (
            <button
              key={field}
              type="button"
              onClick={() => onChange?.(field, active ? "no" : "si")}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none",
                active
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-600",
              ].join(" ")}
            >
              {active && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // mode === "read"
  const active = CONDITIONS.filter(({ field }) => values[field] === "si");

  if (active.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Ninguna condición especial registrada
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(({ field, label }) => (
        <span
          key={field}
          className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-semibold"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
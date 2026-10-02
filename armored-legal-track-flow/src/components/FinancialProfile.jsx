/**
 * FinancialProfile — High-Density ERP-style financial view for a client.
 * Inspirado en motores de originación de crédito y ERPs financieros clásicos.
 */
import { useState } from "react";
import { Pencil, X, Check } from "lucide-react";

const fmt = (n) =>
  n != null && n !== ""
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString("es-CO"); } catch { return d || "—"; }
};

// ── Celda de tabla: etiqueta + valor ──────────────────────────────────────────
const Cell = ({ label, value, mono = false, valueClass = "", colSpan = 1 }) => (
  <div className={`contents`} style={{ gridColumn: `span ${colSpan}` }}>
    <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
      <span className="text-[10px] font-bold uppercase text-gray-600 tracking-wide whitespace-nowrap">{label}</span>
    </div>
    <div className={`bg-white border-r border-b border-gray-400 px-2 py-1 ${valueClass}`}>
      <span className={`text-[11px] font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  </div>
);

// ── Cabecera de sección ───────────────────────────────────────────────────────
const SectionHeader = ({ children, action }) => (
  <div className="flex items-center justify-between bg-gray-700 text-white px-2 py-1 border border-gray-500">
    <span className="text-[10px] font-bold uppercase tracking-widest">{children}</span>
    {action}
  </div>
);

// ── Grid cuadriculado de pares label|value ────────────────────────────────────
const DataGrid = ({ rows, cols = 4 }) => (
  <div
    className="border-l border-t border-gray-400"
    style={{ display: "grid", gridTemplateColumns: `repeat(${cols * 2}, minmax(0, 1fr))` }}
  >
    {rows.map(({ label, value, mono, valueClass }, i) => (
      <div key={i} className="contents">
        <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
          <p className="text-[10px] font-bold uppercase text-gray-600 tracking-wide whitespace-nowrap truncate">{label}</p>
        </div>
        <div className={`bg-white border-r border-b border-gray-400 px-2 py-1 ${valueClass || ""}`}>
          <p className={`text-[11px] font-semibold text-gray-900 truncate ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
        </div>
      </div>
    ))}
  </div>
);

// ── Tabla de obligaciones ────────────────────────────────────────────────────
const ObligacionesTable = ({ reports, getObligationLabel }) => {
  const totalSaldo = reports.reduce((s, r) => s + (r.pending_amount || 0), 0);

  const STATUS_LABEL = {
    pendiente: "PENDIENTE", en_gestion: "EN GESTIÓN",
    eliminado_exito: "ELIMINADO", inviable: "INVIABLE",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-[11px]">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-400 px-2 py-1 text-left font-bold uppercase text-gray-700 text-[10px]">#</th>
            <th className="border border-gray-400 px-2 py-1 text-left font-bold uppercase text-gray-700 text-[10px]">Entidad / Obligación</th>
            <th className="border border-gray-400 px-2 py-1 text-left font-bold uppercase text-gray-700 text-[10px]">Estado Centr.</th>
            <th className="border border-gray-400 px-2 py-1 text-left font-bold uppercase text-gray-700 text-[10px]">Gestión</th>
            <th className="border border-gray-400 px-2 py-1 text-right font-bold uppercase text-gray-700 text-[10px]">Saldo Pendiente</th>
            <th className="border border-gray-400 px-2 py-1 text-left font-bold uppercase text-gray-700 text-[10px]">Perm. Negativa</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-gray-400 px-2 py-3 text-center text-gray-400 text-[11px]">
                Sin obligaciones registradas
              </td>
            </tr>
          ) : (
            reports.map((r, idx) => {
              const isEliminated = r.status === "eliminado_exito";
              const isInviable = r.status === "inviable";
              const rowBg = isEliminated ? "bg-green-50" : isInviable ? "bg-gray-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50";
              const gestionColor = isEliminated ? "text-green-700 font-bold" : isInviable ? "text-gray-500" : "text-gray-800";
              return (
                <tr key={r.id} className={rowBg}>
                  <td className="border border-gray-400 px-2 py-1 text-center text-gray-500">{idx + 1}</td>
                  <td className="border border-gray-400 px-2 py-1">
                    <p className="font-bold uppercase text-gray-800">{r.entity_name}</p>
                    {r.obligation_number && <p className="font-mono text-gray-500 text-[10px]">No. {r.obligation_number}</p>}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-gray-700">
                    {getObligationLabel ? getObligationLabel(r.obligation_status) : r.obligation_status || "—"}
                  </td>
                  <td className={`border border-gray-400 px-2 py-1 ${gestionColor}`}>
                    {STATUS_LABEL[r.status] || r.status || "—"}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-mono font-semibold text-red-700">
                    {r.pending_amount ? fmt(r.pending_amount) : "—"}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-[10px]">
                    {r.has_negative_permanence && r.negative_permanence_until
                      ? <span className="text-red-600 font-semibold">Hasta {fmtDate(r.negative_permanence_until)}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200">
            <td colSpan={4} className="border border-gray-400 px-2 py-1 font-bold uppercase text-gray-700 text-[10px]">
              TOTALES ({reports.length} obligaciones)
            </td>
            <td className="border border-gray-400 px-2 py-1 text-right font-bold font-mono text-red-800">
              {fmt(totalSaldo)}
            </td>
            <td className="border border-gray-400 px-2 py-1" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ── Bloque de liquidación/resumen financiero ──────────────────────────────────
const LiquidacionPanel = ({ client, reports }) => {
  const expectativa = client.valor_expectativa_total || 0;
  const pct = client.porcentaje_anticipo || 0.5;
  const reportes = client.total_reportes_objetivo || 0;
  const cuotas = client.anticipo_cuotas || 1;
  const montoAnticipo = expectativa * pct;
  const montoExito = expectativa * (1 - pct);
  const cuotaAnticipo = cuotas > 0 ? montoAnticipo / cuotas : montoAnticipo;
  const honorarioExitoReporte = reportes > 0 ? montoExito / reportes : 0;
  const totalSaldoPendiente = reports.reduce((s, r) => s + (r.pending_amount || 0), 0);
  const reportesEliminados = reports.filter(r => r.status === "eliminado_exito").length;
  const viable = expectativa > 0 && reportes > 0;

  return (
    <div className="border-l border-t border-gray-400" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))" }}>
      {/* Row 1 */}
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Expectativa Total</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-gray-900 font-mono">{fmt(expectativa)}</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">% Anticipo</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-gray-900">{Math.round(pct * 100)}%</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Reportes Objetivo</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-gray-900">{reportes || "—"}</p>
      </div>

      {/* Row 2 */}
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Total Anticipo</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-semibold text-blue-700 font-mono">{fmt(montoAnticipo)}</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Cuota Anticipo</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-semibold text-blue-700 font-mono">{fmt(cuotaAnticipo)}</p>
        {cuotas > 1 && <p className="text-[9px] text-gray-400">x {cuotas} cuotas</p>}
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Cuotas Anticipo</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-gray-900">{cuotas}</p>
      </div>

      {/* Row 3 */}
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Total Éxito</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-semibold text-green-700 font-mono">{fmt(montoExito)}</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Honor. / Reporte</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-semibold text-green-700 font-mono">{reportes > 0 ? fmt(honorarioExitoReporte) : "—"}</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Eliminados / Total</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-gray-900">{reportesEliminados} / {reports.length}</p>
      </div>

      {/* Row 4 — saldo pendiente + viabilidad */}
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Saldo c/ Centrales</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-2">
        <p className="text-[11px] font-bold text-red-700 font-mono">{fmt(totalSaldoPendiente)}</p>
      </div>
      <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[10px] font-bold uppercase text-gray-600">Saldo Pactado</p>
      </div>
      <div className="bg-white border-r border-b border-gray-400 px-2 py-1 col-span-1">
        <p className="text-[11px] font-bold text-amber-700 font-mono">{fmt(client.pending_balance)}</p>
      </div>
      {/* Viabilidad badge */}
      <div className={`border-r border-b border-gray-400 px-2 py-1 flex items-center justify-center col-span-1 ${viable ? "bg-green-700" : "bg-red-700"}`}>
        <p className="text-[11px] font-black uppercase text-white tracking-widest">
          {viable ? "✓ VIABLE" : "✗ INCOMPLETO"}
        </p>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function FinancialProfile({ client, reports = [], getObligationLabel }) {
  const condicionesActivas = [
    client.victim_conflict === "si" && "Víctima conflicto",
    client.indigenous === "si" && "Indígena",
    client.elderly === "si" && "Adulto mayor",
    client.psychological_impact === "si" && "Afect. psicológica",
    client.single_mother === "si" && "Madre cabeza",
  ].filter(Boolean);

  const SERVICE_LABELS = {
    eliminacion_reportes: "Eliminación Reportes",
    tutela: "Tutela", sic: "SIC", cartera: "Cartera", otro: "Otro",
  };

  return (
    <div className="p-3 space-y-2 bg-gray-50 font-mono text-[11px]">

      {/* ── PANEL 1: Información General ─────────────────────────────── */}
      <div>
        <SectionHeader>I. Información General del Deudor</SectionHeader>
        <DataGrid cols={4} rows={[
          { label: "Nombre completo",   value: client.full_name },
          { label: "Cédula",            value: client.cc,             mono: true },
          { label: "Servicio",          value: SERVICE_LABELS[client.service_type] || client.service_type },
          { label: "Estado",            value: client.status?.replace(/_/g, " ").toUpperCase() },
          { label: "Celular",           value: client.phone,          mono: true },
          { label: "Correo",            value: client.email },
          { label: "Referido por",      value: client.referrer_name },
          { label: "Fecha contrato",    value: client.contract_date ? fmtDate(client.contract_date) : null },
          { label: "Ciudad",            value: client.city },
          { label: "Departamento",      value: client.department },
          { label: "Dirección",         value: client.address },
          { label: "Barrio",            value: client.neighborhood },
          { label: "Valor pactado",     value: fmt(client.agreed_value),      valueClass: "text-right" },
          { label: "Saldo pendiente",   value: fmt(client.pending_balance),   valueClass: "text-right text-amber-700" },
          { label: "Condic. especiales",value: condicionesActivas.length > 0 ? condicionesActivas.join(" · ") : "Ninguna" },
          { label: "Jurisdicción",      value: client.jurisdiction },
        ]} />
      </div>

      {/* ── PANEL 2: Análisis de Riesgo ──────────────────────────────── */}
      {client.service_type === "eliminacion_reportes" && (
        <div>
          <SectionHeader>II. Análisis de Riesgo — Centrales de Información</SectionHeader>
          <div className="grid grid-cols-2 gap-0 border-l border-t border-gray-400">
            {/* Izquierda: Scores */}
            <div>
              <div className="bg-gray-200 border-r border-b border-gray-400 px-2 py-1">
                <p className="text-[10px] font-bold uppercase text-gray-600">Central</p>
              </div>
              <div className="border-r border-gray-400">
                <div className="grid grid-cols-2">
                  <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[10px] font-bold uppercase text-gray-600">DataCrédito</p>
                  </div>
                  <div className="bg-white border-r border-b border-gray-400 px-2 py-1">
                    <p className={`text-[14px] font-black font-mono ${(client.score_data || 0) >= 700 ? "text-green-700" : (client.score_data || 0) >= 500 ? "text-amber-600" : "text-red-700"}`}>
                      {client.score_data ?? "—"}
                    </p>
                    <p className="text-[9px] text-gray-400">/ 1000 pts</p>
                  </div>
                  <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[10px] font-bold uppercase text-gray-600">TransUnion</p>
                  </div>
                  <div className="bg-white border-r border-b border-gray-400 px-2 py-1">
                    <p className={`text-[14px] font-black font-mono ${(client.score_transunion || 0) >= 700 ? "text-green-700" : (client.score_transunion || 0) >= 500 ? "text-amber-600" : "text-red-700"}`}>
                      {client.score_transunion ?? "—"}
                    </p>
                    <p className="text-[9px] text-gray-400">/ 1000 pts</p>
                  </div>
                  <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[10px] font-bold uppercase text-gray-600">Clave DC</p>
                  </div>
                  <div className="bg-white border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[11px] font-mono text-gray-800">{client.datacredito_key || "—"}</p>
                  </div>
                  <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[10px] font-bold uppercase text-gray-600">Clave TU</p>
                  </div>
                  <div className="bg-white border-r border-b border-gray-400 px-2 py-1">
                    <p className="text-[11px] font-mono text-gray-800">{client.transunion_key || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Derecha: Estructura de cobro */}
            <div>
              <div className="bg-gray-200 border-r border-b border-gray-400 px-2 py-1">
                <p className="text-[10px] font-bold uppercase text-gray-600">Estructura Honorarios</p>
              </div>
              <div className="grid grid-cols-2">
                {[
                  { label: "Expectativa total", value: fmt(client.valor_expectativa_total), valueClass: "text-right font-bold" },
                  { label: "% Anticipo",         value: `${Math.round((client.porcentaje_anticipo || 0.5) * 100)}%` },
                  { label: "Total anticipo",     value: fmt((client.valor_expectativa_total || 0) * (client.porcentaje_anticipo || 0.5)), valueClass: "text-right text-blue-700" },
                  { label: "Total éxito",        value: fmt((client.valor_expectativa_total || 0) * (1 - (client.porcentaje_anticipo || 0.5))), valueClass: "text-right text-green-700" },
                  { label: "Reportes objetivo",  value: client.total_reportes_objetivo || "—" },
                  { label: "Cuotas anticipo",    value: client.anticipo_cuotas || 1 },
                ].map(({ label, value, valueClass }, i) => (
                  <div key={i} className="contents">
                    <div className="bg-gray-100 border-r border-b border-gray-400 px-2 py-1">
                      <p className="text-[10px] font-bold uppercase text-gray-600 whitespace-nowrap truncate">{label}</p>
                    </div>
                    <div className={`bg-white border-r border-b border-gray-400 px-2 py-1 ${valueClass || ""}`}>
                      <p className="text-[11px] font-semibold text-gray-900">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL 3: Tabla de Obligaciones ───────────────────────────── */}
      <div>
        <SectionHeader>III. Obligaciones en Centrales de Riesgo ({reports.length})</SectionHeader>
        <ObligacionesTable reports={reports} getObligationLabel={getObligationLabel} />
      </div>

      {/* ── PANEL 4: Liquidación / Cuadro de Mando ───────────────────── */}
      <div>
        <SectionHeader>IV. Liquidación y Cuadro de Mando</SectionHeader>
        <LiquidacionPanel client={client} reports={reports} />
      </div>

      {/* ── PANEL 5: Datos proceso ejecutivo (condicional) ───────────── */}
      {(client.service_type === "cartera" || client.service_type === "otro") &&
        (client.ejecutivo_juzgado || client.ejecutivo_acreedor) && (
        <div>
          <SectionHeader>V. Datos del Proceso Ejecutivo / Cartera</SectionHeader>
          <DataGrid cols={4} rows={[
            { label: "Juzgado",       value: client.ejecutivo_juzgado },
            { label: "Acreedor",      value: client.ejecutivo_acreedor },
            { label: "Deudor",        value: client.ejecutivo_deudor },
            { label: "Título",        value: client.ejecutivo_titulo },
            { label: "Cuantía",       value: fmt(client.ejecutivo_cuantia), valueClass: "text-right text-red-700" },
            { label: "—", value: "" },
            { label: "—", value: "" },
            { label: "—", value: "" },
          ]} />
        </div>
      )}

    </div>
  );
}
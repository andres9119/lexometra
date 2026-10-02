/**
 * ClientResumenPage — Vista standalone de resumen del cliente.
 * Se abre en nueva pestaña. Optimizada para impresión.
 */
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useObligationStatuses } from "@/hooks/useObligationStatuses";
import { Printer } from "lucide-react";

const fmt = (n) =>
  n != null && n !== ""
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtDate = (d) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-CO"); } catch { return d || "—"; }
};

const TH = ({ children, className = "" }) => (
  <th className={`border border-gray-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white bg-slate-700 ${className}`}>
    {children}
  </th>
);
const TD = ({ children, className = "", colSpan }) => (
  <td colSpan={colSpan} className={`border border-gray-400 px-2 py-1 text-[11px] ${className}`}>
    {children}
  </td>
);

const STATUS_LABEL = {
  pendiente: "PENDIENTE", en_gestion: "EN GESTIÓN",
  eliminado_exito: "ELIMINADO ✓", inviable: "INVIABLE",
};
const STATUS_COLOR = {
  pendiente: "text-amber-700", en_gestion: "text-blue-700",
  eliminado_exito: "text-green-700 font-bold", inviable: "text-gray-500",
};
const SERVICE_LABELS = {
  eliminacion_reportes: "Eliminación de Reportes",
  tutela: "Acción de Tutela", sic: "Proceso SIC",
  cartera: "Gestión de Cartera", otro: "Otro",
};

export default function ClientResumenPage() {
  const { id } = useParams();
  const { getLabel: getObligationLabel } = useObligationStatuses();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then((ok) => {
      if (!ok) {
        base44.auth.redirectToLogin(window.location.href);
      } else {
        setAuthChecked(true);
      }
    });
  }, []);

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ["client", id],
    queryFn: () => base44.entities.Client.get(id),
    enabled: authChecked,
  });
  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => base44.entities.ClientNegativeReport.filter({ client_id: id }),
    enabled: authChecked,
  });

  if (!authChecked) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );

  if (loadingClient || loadingReports) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (!client) return <div className="p-10 text-center text-gray-500">Cliente no encontrado.</div>;

  const expectativa = parseFloat(client.valor_expectativa_total) || 0;
  const pct = parseFloat(client.porcentaje_anticipo) || 0.5;
  const reportesObj = parseInt(client.total_reportes_objetivo) || 0;
  const cuotas = parseInt(client.anticipo_cuotas) || 1;
  const montoAnticipo = expectativa * pct;
  const montoExito = expectativa * (1 - pct);
  const cuotaAnticipo = cuotas > 0 ? montoAnticipo / cuotas : montoAnticipo;
  const honorarioReporte = reportesObj > 0 ? montoExito / reportesObj : 0;
  const totalSaldo = reports.reduce((s, r) => s + (r.pending_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de acciones — solo pantalla */}
      <div className="no-print bg-slate-800 px-5 py-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">
          Resumen de Cliente — Vista de Entrega
        </span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1 bg-white text-slate-800 font-bold hover:bg-gray-100 border border-gray-300"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
        </button>
      </div>

      {/* Contenido imprimible */}
      <div id="resumen-print" className="max-w-4xl mx-auto bg-white p-6 my-4 shadow-sm space-y-4 text-[11px]">

        {/* Encabezado */}
        <div className="border-b-2 border-slate-700 pb-2 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resumen de Asesoría Legal</p>
          <p className="text-[9px] text-gray-400 mt-0.5">
            Generado el {new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* BLOQUE I: Info del Cliente */}
        <div>
          <div className="bg-slate-700 text-white px-2 py-1 border border-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">I. Información del Cliente</span>
          </div>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <TD className="bg-gray-100 font-bold text-gray-700 w-36">NOMBRE COMPLETO</TD>
                <TD className="font-semibold text-gray-900">{client.full_name}</TD>
                <TD className="bg-gray-100 font-bold text-gray-700 w-24">CÉDULA</TD>
                <TD className="font-mono font-semibold text-gray-900 w-32">{client.cc}</TD>
              </tr>
              <tr>
                <TD className="bg-gray-100 font-bold text-gray-700">SERVICIO</TD>
                <TD colSpan={3} className="font-semibold text-gray-900">
                  {SERVICE_LABELS[client.service_type] || client.service_type || "—"}
                </TD>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BLOQUE II: Reportes */}
        <div>
          <div className="bg-slate-700 text-white px-2 py-1 border border-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">
              II. Reportes Negativos en Centrales ({reports.length})
            </span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Entidad</TH>
                <TH>No. Obligación</TH>
                <TH>Estado Central</TH>
                <TH>Gestión</TH>
                <TH className="text-right">Saldo</TH>
                <TH>Perm. Negativa</TH>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <TD colSpan={7} className="text-center text-gray-400 italic py-3">Sin reportes registrados</TD>
                </tr>
              ) : reports.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                  <TD className="text-center text-gray-500 w-7">{idx + 1}</TD>
                  <TD className="font-bold uppercase text-gray-800">{r.entity_name}</TD>
                  <TD className="font-mono text-gray-500">{r.obligation_number || "—"}</TD>
                  <TD className="uppercase font-semibold text-gray-700">
                    {getObligationLabel ? getObligationLabel(r.obligation_status) : (r.obligation_status || "—")}
                  </TD>
                  <TD className={`font-semibold ${STATUS_COLOR[r.status] || "text-gray-800"}`}>
                    {STATUS_LABEL[r.status] || r.status || "—"}
                  </TD>
                  <TD className="text-right font-mono font-semibold text-red-700">
                    {r.pending_amount ? fmt(r.pending_amount) : "—"}
                  </TD>
                  <TD className="text-[10px]">
                    {r.has_negative_permanence && r.negative_permanence_until
                      ? <span className="text-red-600 font-semibold">Hasta {fmtDate(r.negative_permanence_until)}</span>
                      : <span className="text-gray-400">—</span>}
                  </TD>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200">
                <TD colSpan={5} className="font-bold uppercase text-gray-700 text-[10px]">
                  TOTAL — {reports.length} obligación{reports.length !== 1 ? "es" : ""}
                </TD>
                <TD className="text-right font-bold font-mono text-red-800">{fmt(totalSaldo)}</TD>
                <TD />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BLOQUE III: Cobro */}
        <div>
          <div className="bg-slate-700 text-white px-2 py-1 border border-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">III. Estructura de Cobro Mixto</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>Expectativa Total</TH>
                <TH>% Anticipo</TH>
                <TH>Reportes Obj.</TH>
                <TH>Cuotas</TH>
                <TH>Total Anticipo</TH>
                <TH>Cuota Anticipo</TH>
                <TH>Total Éxito</TH>
                <TH>Honor./Reporte</TH>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <TD className="text-right font-mono font-bold">{fmt(expectativa)}</TD>
                <TD className="text-center font-bold">{Math.round(pct * 100)}%</TD>
                <TD className="text-center font-bold">{reportesObj || "—"}</TD>
                <TD className="text-center font-bold">{cuotas}</TD>
                <TD className="text-right font-mono font-bold text-blue-700">{fmt(montoAnticipo)}</TD>
                <TD className="text-right font-mono font-bold text-blue-700">
                  {fmt(cuotaAnticipo)}
                  {cuotas > 1 && <span className="block text-[9px] text-gray-400 font-normal">x {cuotas} cuotas</span>}
                </TD>
                <TD className="text-right font-mono font-bold text-green-700">{fmt(montoExito)}</TD>
                <TD className="text-right font-mono font-bold text-green-700">{reportesObj > 0 ? fmt(honorarioReporte) : "—"}</TD>
              </tr>
            </tbody>
          </table>

          {cuotas > 1 && (
            <div className="mt-2">
              <div className="bg-gray-200 border border-gray-400 px-2 py-0.5">
                <span className="text-[9px] font-bold uppercase text-gray-600 tracking-wider">Cronograma de Pagos del Anticipo</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr><TH># Cuota</TH><TH>Valor</TH><TH>Fecha de Vencimiento</TH></tr>
                </thead>
                <tbody>
                  {Array.from({ length: cuotas }, (_, i) => {
                    const fecha = client.anticipo_dates?.[i] ?? "";
                    return (
                      <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                        <TD className="text-center font-bold text-gray-600">{i + 1}</TD>
                        <TD className="text-right font-mono font-semibold text-blue-700">{fmt(cuotaAnticipo)}</TD>
                        <TD className="font-mono text-gray-800">{fecha ? fmtDate(fecha) : "—"}</TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-2 text-[9px] text-gray-400 text-center">
          Este documento es un resumen de asesoría. No constituye contrato ni comprobante de pago.
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #resumen-print { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
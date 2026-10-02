import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Calendar, FileSpreadsheet, FileText, LayoutList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Constants ──────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  tutela:    "Acción de Tutela",
  peticion:  "Derecho de Petición",
  recurso:   "Recurso",
  queja_sic: "Queja SIC",
  demanda:   "Demanda Civil",
  incidente: "Incidente",
  otro:      "Otro",
};

const TYPE_COLORS = {
  tutela:    "bg-violet-100 text-violet-700 border-violet-200",
  peticion:  "bg-blue-100 text-blue-700 border-blue-200",
  recurso:   "bg-orange-100 text-orange-700 border-orange-200",
  queja_sic: "bg-cyan-100 text-cyan-700 border-cyan-200",
  demanda:   "bg-rose-100 text-rose-700 border-rose-200",
  incidente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  otro:      "bg-slate-100 text-slate-600 border-slate-200",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return "—"; }
};

// ── Deadline badge ──────────────────────────────────────────────────────────
function DeadlineBadge({ date }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <AlertTriangle className="h-2.5 w-2.5" /> VENCIDO
      </span>
    );
  if (days === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <AlertTriangle className="h-2.5 w-2.5" /> HOY
      </span>
    );
  if (days <= 7)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
        <Calendar className="h-2.5 w-2.5" /> {fmtDate(date)}
      </span>
    );
  return <span className="text-xs text-muted-foreground">{fmtDate(date)}</span>;
}

// ── Export helpers ──────────────────────────────────────────────────────────
async function doExportExcel(rows, plaintiff) {
  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet("Actuaciones");
  const now      = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  const COLS     = 6;

  sheet.mergeCells(1, 1, 1, COLS);
  const t = sheet.getCell("A1");
  t.value = `Actuaciones Jurídicas — Expediente: ${plaintiff || "—"}`;
  t.font  = { name: "Calibri", bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  t.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, COLS);
  const d = sheet.getCell("A2");
  d.value = `Generado el ${now}`;
  d.font  = { name: "Calibri", italic: true, size: 9, color: { argb: "FF64748B" } };
  d.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 16;

  const HEADERS = ["Proceso", "Entidad Accionada", "Juzgado / Autoridad", "Radicado", "Etapa Actual", "Vencimiento"];
  const hRow = sheet.getRow(3);
  HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "FF1E3A8A" } } };
  });
  hRow.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  rows.forEach((r, idx) => {
    const row = sheet.addRow([r.proceso, r.entidad, r.juzgado, r.radicado, r.etapa, r.vencimiento ? fmtDate(r.vencimiento) : "—"]);
    const bg  = idx % 2 === 0 ? "FFFFFFFF" : "FFF1F5F9";
    row.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
    const vc = row.getCell(6);
    if (r.vencimiento) {
      const diff = differenceInDays(parseISO(r.vencimiento), new Date());
      if (diff < 0) vc.font = { name: "Calibri", size: 10, color: { argb: "FFDC2626" }, bold: true };
      else if (diff <= 7) vc.font = { name: "Calibri", size: 10, color: { argb: "FFD97706" }, bold: true };
    }
    row.height = 18;
  });

  [30, 28, 32, 20, 32, 16].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const link   = document.createElement("a");
  link.href    = url;
  link.download = `Actuaciones_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function doExportPDF(rows, plaintiff) {
  const now = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Actuaciones Jurídicas — Accionante: ${plaintiff || "—"}`, 14, 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado el ${now}  ·  ${rows.length} registros`, 14, 21);

  autoTable(doc, {
    head: [["Proceso", "Entidad Accionada", "Juzgado / Autoridad", "Radicado", "Etapa Actual", "Vencimiento"]],
    body: rows.map(r => [r.proceso, r.entidad, r.juzgado, r.radicado, r.etapa, r.vencimiento ? fmtDate(r.vencimiento) : "—"]),
    startY: 26,
    styles: {
      font: "helvetica", fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [226, 232, 240], lineWidth: 0.2,
      valign: "middle", textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59], textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 8.5, halign: "center",
    },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 36 }, 2: { cellWidth: 42 },
      3: { cellWidth: 26 }, 4: { cellWidth: 48 }, 5: { cellWidth: 22, halign: "center" },
    },
    margin: { top: 26, left: 14, right: 14, bottom: 16 },
    showHead: "everyPage",
    didDrawPage: () => {
      const total   = doc.internal.getNumberOfPages();
      const current = doc.internal.getCurrentPageInfo().pageNumber;
      const pageW   = doc.internal.pageSize.getWidth();
      const pageH   = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${current} de ${total}`, pageW / 2, pageH - 8, { align: "center" });
      doc.text("Confidencial", 14, pageH - 8);
    },
  });

  // Preview in new tab instead of auto-download
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);
  window.open(blobUrl, "_blank");
}

// ── Inner table (used inside Modal) ────────────────────────────────────────
function ActuacionesTableInner({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            {["Proceso", "Entidad Accionada", "Juzgado / Autoridad", "Radicado", "Etapa Actual", "Vencimiento"].map(col => (
              <th key={col} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b border-border">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}>
              <td className="px-4 py-2.5 border-b border-border/50">
                <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${TYPE_COLORS[row.type] || TYPE_COLORS.otro}`}>
                  {row.proceso}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-foreground border-b border-border/50 max-w-[160px] truncate">{row.entidad}</td>
              <td className="px-4 py-2.5 text-xs text-foreground border-b border-border/50 max-w-[180px] truncate">{row.juzgado}</td>
              <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground border-b border-border/50 whitespace-nowrap">{row.radicado}</td>
              <td className="px-4 py-2.5 text-xs text-foreground border-b border-border/50 max-w-[200px] truncate">{row.etapa}</td>
              <td className="px-4 py-2.5 border-b border-border/50 whitespace-nowrap">
                <DeadlineBadge date={row.vencimiento} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modal wrapper ───────────────────────────────────────────────────────────
function ActuacionesModal({ open, onClose, rows, plaintiff }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full p-0 gap-0 overflow-hidden" hideCloseButton>
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30 space-y-0">
          <div className="flex items-center gap-2">
            <LayoutList className="h-4 w-4 text-muted-foreground" />
            <DialogTitle className="text-sm font-semibold">
              Resumen de Actuaciones
              <span className="ml-2 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {rows.length} registro{rows.length !== 1 ? "s" : ""}
              </span>
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => doExportPDF(rows, plaintiff)}
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => doExportExcel(rows, plaintiff)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <ActuacionesTableInner rows={rows} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Public export: Trigger button + Modal ───────────────────────────────────
export default function ActuacionesTable({ legalActions = [], macroProcessId, plaintiff }) {
  const [open, setOpen] = useState(false);

  const actionIds = legalActions.map(a => a.id);

  const { data: allStages = [] } = useQuery({
    queryKey: ["stages_table", macroProcessId],
    queryFn: async () => {
      if (actionIds.length === 0) return [];
      const results = await Promise.all(
        actionIds.map(aid => base44.entities.ProcessStage.filter({ process_id: aid }, "-date"))
      );
      return results.flat();
    },
    enabled: open && legalActions.length > 0,
  });

  const rows = legalActions.map(action => {
    const stages = allStages.filter(s => s.process_id === action.id);
    const latest = stages.length > 0 ? stages[0] : null;
    return {
      id:          action.id,
      proceso:     TYPE_LABELS[action.type] || "Otro",
      type:        action.type,
      entidad:     action.judge_entity || "—",
      juzgado:     action.judge_entity || "—",
      radicado:    action.case_number  || "—",
      etapa:       latest?.stage_name  || (action.current_stage || "—"),
      vencimiento: action.next_deadline || null,
      status:      action.status,
    };
  });

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <LayoutList className="h-3.5 w-3.5" /> Vista Resumen
      </Button>

      <ActuacionesModal
        open={open}
        onClose={() => setOpen(false)}
        rows={rows}
        plaintiff={plaintiff}
      />
    </>
  );
}
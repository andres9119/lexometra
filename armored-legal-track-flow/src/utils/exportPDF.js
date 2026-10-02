import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: es }); } catch { return "—"; }
};

export function exportToPDF(rows) {
  const now    = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  const doc    = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const STATUS_LABELS = { activo: "Activo", en_tramite: "En Trámite" };

  // ── Title ──
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("Reporte de Actuaciones Jurídicas Activas — LegalTrack", 14, 16);

  // ── Subtitle / date ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Generado el ${now}  ·  ${rows.length} registros`, 14, 22);

  // ── Table ──
  const head = [[
    "Cliente / Expediente",
    "Tipo Actuación",
    "Entidad / Juzgado",
    "Radicado",
    "Última Etapa",
    "Vencimiento",
    "Abogado",
    "Estado",
  ]];

  const body = rows.map(r => [
    r.cliente,
    r.tipo,
    r.entidad,
    r.radicado,
    r.etapa,
    fmtDate(r.vencimiento),
    r.abogado,
    STATUS_LABELS[r.status] || r.status,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 27,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [226, 232, 240],   // slate-200
      lineWidth: 0.2,
      valign: "middle",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 64, 175],     // blue-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],   // slate-100 zebra
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 40 },         // Cliente
      1: { cellWidth: 28 },         // Tipo
      2: { cellWidth: 38 },         // Entidad
      3: { cellWidth: 24 },         // Radicado
      4: { cellWidth: 38 },         // Etapa
      5: { cellWidth: 22, halign: "center" }, // Vencimiento
      6: { cellWidth: 30 },         // Abogado
      7: { cellWidth: 16, halign: "center" }, // Estado
    },
    margin: { top: 27, left: 14, right: 14, bottom: 18 },
    showHead: "everyPage",
    // ── Footer: page number ──
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      const current   = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      const pageW = doc.internal.pageSize.getWidth();
      doc.text(
        `Página ${current} de ${pageCount}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
      doc.text(
        "LegalTrack — Confidencial",
        14,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  doc.save(`Reporte_Actuaciones_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
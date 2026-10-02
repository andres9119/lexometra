import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: es }); } catch { return "—"; }
};

export async function exportToExcel(rows) {
  const workbook  = new ExcelJS.Workbook();
  const sheet     = workbook.addWorksheet("Actuaciones Activas");
  const now       = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  const COLS      = 8;
  const HEADER_ROW = 3;

  // ── Row 1: Title ──
  sheet.mergeCells(1, 1, 1, COLS);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "Reporte de Actuaciones Jurídicas Activas — LegalTrack";
  titleCell.font  = { name: "Calibri", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  // ── Row 2: Date ──
  sheet.mergeCells(2, 1, 2, COLS);
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Generado el ${now}`;
  dateCell.font  = { name: "Calibri", italic: true, size: 10, color: { argb: "FF64748B" } };
  dateCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 18;

  // ── Row 3: Headers ──
  const headers = [
    "Cliente / Expediente",
    "Tipo Actuación",
    "Entidad / Juzgado",
    "Radicado",
    "Última Etapa",
    "Vencimiento",
    "Abogado",
    "Estado",
  ];

  const headerRow = sheet.getRow(HEADER_ROW);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
    };
  });
  headerRow.height = 22;

  // Freeze header row
  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];

  // ── Data rows ──
  const STATUS_LABELS = { activo: "Activo", en_tramite: "En Trámite" };

  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow([
      row.cliente,
      row.tipo,
      row.entidad,
      row.radicado,
      row.etapa,
      fmtDate(row.vencimiento),
      row.abogado,
      STATUS_LABELS[row.status] || row.status,
    ]);

    // Zebra striping
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF1F5F9";
    dataRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    dataRow.height = 18;

    // Color vencimiento si venció o está próximo
    const vCell = dataRow.getCell(6);
    if (row.vencimiento) {
      const d = new Date(row.vencimiento);
      const now = new Date();
      if (d < now) {
        vCell.font = { ...vCell.font, color: { argb: "FFDC2626" }, bold: true };
      } else if ((d - now) < 7 * 24 * 60 * 60 * 1000) {
        vCell.font = { ...vCell.font, color: { argb: "FFD97706" }, bold: true };
      }
    }
  });

  // ── Auto-width ──
  const colWidths = [28, 22, 28, 18, 30, 16, 24, 12];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ── Download ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `Reporte_Actuaciones_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
import { jsPDF } from "jspdf";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (dateStr) => {
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  try {
    const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return dateStr || ""; }
};

export function generateAgreementPDF(agreement, installments) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 18;

  const typeLabel = agreement.type === "credito" ? "CRÉDITO" : "ACUERDO DE PAGO";
  const todayStr = fmtDate(agreement.start_date);

  // ── Date top-right ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(todayStr, pageW - margin, y, { align: "right" });

  y += 10;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(typeLabel, pageW / 2, y, { align: "center" });

  y += 10;

  // ── Body paragraph ──
  const interestPct = agreement.interest_rate || 0;
  const bodyText =
    `Por medio del presente, confirmo que acepto el pago del saldo pendiente por valor de ` +
    `${fmt(agreement.total_amount)} más intereses del ${interestPct},00%, para un total de ` +
    `${fmt(agreement.total_with_interest)} a favor de LegalTrack correspondiente a la cuenta registrada ` +
    `a nombre de ${(agreement.client_name || "").toUpperCase()} con cédula ${agreement.client_cc || "—"} ` +
    `para ser cancelado en ${agreement.num_installments} cuota${agreement.num_installments !== 1 ? "s" : ""}.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  const bodyLines = doc.splitTextToSize(bodyText, contentW);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 5 + 6;

  // ── Incumplimiento clause ──
  const clause =
    "En caso de incumplimiento en el pago de cualquiera de las cuotas, autorizo que el saldo restante se " +
    "considere como deuda total y que la empresa aplique las sanciones correspondientes conforme a lo " +
    "estipulado en el Contrato de Condiciones Uniformes (CCU).";
  const clauseLines = doc.splitTextToSize(clause, contentW);
  doc.text(clauseLines, margin, y);
  y += clauseLines.length * 5 + 8;

  // ── Descripción de la deuda ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const descLabel = "Descripción de la deuda: ";
  doc.text(descLabel, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(agreement.description || "—", margin + doc.getStringUnitWidth(descLabel) * 9 / doc.internal.scaleFactor, y);
  y += 7;

  // ── Amortization table ──
  const cols = [
    { header: "Nº cuota",        width: 22,  align: "center" },
    { header: "Abono a capital", width: 46,  align: "right"  },
    { header: "Interés",         width: 38,  align: "right"  },
    { header: "Cuota total",     width: 40,  align: "right"  },
    { header: "Saldo",           width: 24,  align: "right"  },
  ];
  const tableW = cols.reduce((s, c) => s + c.width, 0);
  const tableX = margin + (contentW - tableW) / 2;

  // Header row
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(180, 180, 180);
  let x = tableX;
  const rowH = 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  cols.forEach(col => {
    doc.rect(x, y, col.width, rowH);
    const tx = col.align === "right" ? x + col.width - 2 : col.align === "center" ? x + col.width / 2 : x + 2;
    doc.text(col.header, tx, y + 4.8, { align: col.align });
    x += col.width;
  });
  y += rowH;

  // Row 0: initial balance
  const initialBalance = agreement.total_amount || 0;
  const row0 = ["0", "  -", "  -", "  -", fmt(initialBalance)];
  x = tableX;
  doc.setFont("helvetica", "normal");
  doc.setFillColor(255, 255, 255);
  cols.forEach((col, i) => {
    doc.rect(x, y, col.width, rowH);
    const tx = col.align === "right" ? x + col.width - 2 : col.align === "center" ? x + col.width / 2 : x + 2;
    doc.text(row0[i], tx, y + 4.8, { align: col.align });
    x += col.width;
  });
  y += rowH;

  // Data rows
  installments.forEach((inst, idx) => {
    if (y > 255) { doc.addPage(); y = 20; }
    const bg = idx % 2 === 0 ? [252, 252, 252] : [255, 255, 255];
    doc.setFillColor(...bg);
    x = tableX;
    const cells = [
      { val: `${inst.installment_number}`, align: "center" },
      { val: fmt(inst.capital),            align: "right"  },
      { val: fmt(inst.interest),           align: "right"  },
      { val: fmt(inst.amount),             align: "right"  },
      { val: fmt(inst.balance),            align: "right"  },
    ];
    cols.forEach((col, i) => {
      doc.rect(x, y, col.width, rowH);
      const tx = col.align === "right" ? x + col.width - 2 : col.align === "center" ? x + col.width / 2 : x + 2;
      doc.text(cells[i].val, tx, y + 4.8, { align: cells[i].align });
      x += col.width;
    });
    y += rowH;
  });

  // Total row
  const totalCap = installments.reduce((s, i) => s + (i.capital || 0), 0);
  const totalInt = installments.reduce((s, i) => s + (i.interest || 0), 0);
  const totalAmt = installments.reduce((s, i) => s + (i.amount || 0), 0);
  doc.setFont("helvetica", "bold");
  x = tableX;
  const totalCells = [
    { val: "Total", align: "center" },
    { val: fmt(totalCap), align: "right" },
    { val: "",            align: "right" },
    { val: fmt(totalAmt), align: "right" },
    { val: "",            align: "right" },
  ];
  cols.forEach((col, i) => {
    doc.rect(x, y, col.width, rowH);
    const tx = col.align === "right" ? x + col.width - 2 : col.align === "center" ? x + col.width / 2 : x + 2;
    if (totalCells[i].val) doc.text(totalCells[i].val, tx, y + 4.8, { align: totalCells[i].align });
    x += col.width;
  });
  y += rowH + 10;

  // ── Reconocimiento y aceptación ──
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Reconocimiento y aceptación", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const recText = "El abajo firmante reconoce el monto total de la deuda pendiente y acepta los términos y condiciones del acuerdo de pago establecido.";
  const recLines = doc.splitTextToSize(recText, contentW);
  doc.text(recLines, margin, y);
  y += recLines.length * 5 + 14;

  // ── Signature line ──
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setDrawColor(80, 80, 80);
  doc.line(margin, y, margin + 75, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${agreement.client_cc || ""} ${agreement.client_name || ""}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha: ", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(todayStr, margin + 14, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Identificación: ", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(agreement.client_cc || "", margin + 26, y);

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${pg} de ${pageCount}  —  LegalTrack`, pageW / 2, 290, { align: "center" });
  }

  doc.save(`${typeLabel.replace(/\s+/g,"_")}_${(agreement.client_name||"").replace(/\s+/g,"_")}_${agreement.client_cc||""}.pdf`);
}
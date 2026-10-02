import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { FileDown, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

const fmtDate = (d) => {
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return d || "—"; }
};

const TYPE_LABELS = {
  tutela: "Acción de Tutela", peticion: "Derecho de Petición",
  recurso: "Recurso", queja_sic: "Queja SIC",
  demanda: "Demanda Civil", incidente: "Incidente", otro: "Otro",
};

const STATUS_LABELS = {
  completada: "Completada", en_curso: "En curso", pendiente: "Pendiente",
};

export default function ActionDownloadButtons({ action }) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);

  // Fetch stages for this action
  const { data: stages = [] } = useQuery({
    queryKey: ["stages", action.id],
    queryFn: () => base44.entities.ProcessStage.filter({ process_id: action.id }, "order"),
    enabled: !!action.id,
  });

  // Fetch documents linked to this action
  const { data: docs = [] } = useQuery({
    queryKey: ["docs_actuacion", action.id],
    queryFn: () => base44.entities.DocumentoExpediente.filter({ actuacion_id: action.id }),
    enabled: !!action.id,
  });

  // Also check stage attachments
  const stageAttachments = stages.flatMap(s =>
    (s.attachments || []).map(a => ({ ...a, stageName: s.stage_name }))
  );

  const totalDocs = docs.length + stageAttachments.length;

  const handleDownloadPdf = async () => {
    setLoadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("INFORME DE ACTUACIÓN JURÍDICA", margin, 13);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, margin, 21);
      y = 38;

      // Title block
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(action.title || TYPE_LABELS[action.type] || "Actuación", margin, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Tipo: ${TYPE_LABELS[action.type] || action.type}`, margin, y);
      y += 5;
      if (action.judge_entity) { doc.text(`Juzgado / Entidad: ${action.judge_entity}`, margin, y); y += 5; }
      if (action.case_number) { doc.text(`Radicado: ${action.case_number}`, margin, y); y += 5; }
      if (action.start_date) { doc.text(`Fecha de inicio: ${fmtDate(action.start_date)}`, margin, y); y += 5; }
      if (action.next_deadline) { doc.text(`Próximo vencimiento: ${fmtDate(action.next_deadline)}`, margin, y); y += 5; }

      const statusLabel = { activo: "Activo", en_tramite: "En trámite", finalizado: "Finalizado", archivado: "Archivado" }[action.status] || action.status;
      doc.text(`Estado: ${statusLabel}`, margin, y); y += 5;

      if (action.notes) {
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Observaciones:", margin, y); y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        const lines = doc.splitTextToSize(action.notes, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 3;
      }

      // Stages table
      y += 5;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Etapas del proceso", margin, y);
      y += 4;

      if (stages.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120, 120, 120);
        doc.text("Sin etapas registradas.", margin, y + 6);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y + 2,
          margin: { left: margin, right: margin },
          head: [["#", "Etapa", "Fecha", "Vencimiento", "Estado", "Descripción"]],
          body: stages.map((s, i) => [
            i + 1,
            s.stage_name || "",
            s.date ? fmtDate(s.date) : "—",
            s.term_deadline ? fmtDate(s.term_deadline) : "—",
            STATUS_LABELS[s.status] || s.status || "—",
            s.description || "",
          ]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 5: { cellWidth: 60 } },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // Documents section
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      if (y > 260) { doc.addPage(); y = margin; }
      doc.text("Documentos adjuntos", margin, y);
      y += 4;

      const allFiles = [
        ...docs.map(d => ({ name: d.nombre_original, source: "Documento general" })),
        ...stageAttachments.map(a => ({ name: a.name, source: `Etapa: ${a.stageName}` })),
      ];

      if (allFiles.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120, 120, 120);
        doc.text("Sin documentos adjuntos.", margin, y + 6);
      } else {
        autoTable(doc, {
          startY: y + 2,
          margin: { left: margin, right: margin },
          head: [["Nombre del archivo", "Origen"]],
          body: allFiles.map(f => [f.name, f.source]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        });
      }

      // Footer on all pages
      const pages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${p} de ${pages}`, pageW / 2, 292, { align: "center" });
      }

      const safeName = (action.title || action.type || "actuacion").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, "").trim();
      doc.save(`Informe_${safeName}.pdf`);
      toast.success("Informe PDF descargado");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el informe");
    }
    setLoadingPdf(false);
  };

  const handleDownloadZip = async () => {
    if (totalDocs === 0) {
      toast.info("Esta actuación no tiene documentos adjuntos");
      return;
    }
    setLoadingZip(true);
    try {
      const filesToZip = [
        ...docs.map(d => ({ url: d.url_storage, name: d.nombre_original })),
        ...stageAttachments.map(a => ({ url: a.url, name: a.name })),
      ];

      const zip = new JSZip();
      await Promise.all(
        filesToZip.map(async (f) => {
          const res = await fetch(f.url);
          const blob = await res.blob();
          zip.file(f.name, blob);
        })
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (action.title || action.type || "actuacion").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, "").trim();
      a.download = `Documentos_${safeName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP con ${filesToZip.length} archivo(s) descargado`);
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el ZIP");
    }
    setLoadingZip(false);
  };

  return (
    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleDownloadPdf}
        disabled={loadingPdf}
        title="Descargar informe PDF"
      >
        {loadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        Informe
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 text-xs gap-1.5 ${totalDocs === 0 ? "opacity-40" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
        onClick={handleDownloadZip}
        disabled={loadingZip || totalDocs === 0}
        title={totalDocs === 0 ? "Sin documentos adjuntos" : `Descargar ${totalDocs} documento(s) en ZIP`}
      >
        {loadingZip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
        ZIP {totalDocs > 0 && <span className="bg-muted rounded px-1">{totalDocs}</span>}
      </Button>
    </div>
  );
}
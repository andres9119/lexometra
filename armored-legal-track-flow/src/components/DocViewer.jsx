import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText, Image, File } from "lucide-react";

function getDocType(url, mime) {
  const lower = (url || "").toLowerCase();
  if (mime?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return "image";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  return "other";
}

export default function DocViewer({ doc, onClose }) {
  if (!doc) return null;
  const docType = getDocType(doc.url || doc.url_storage, doc.mime || doc.tipo_mime);
  const url = doc.url || doc.url_storage;
  const name = doc.name || doc.nombre_original || "Documento";

  return (
    <Dialog open={!!doc} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" hideCloseButton>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {docType === "pdf"   && <FileText className="h-4 w-4 text-red-500 shrink-0" />}
            {docType === "image" && <Image className="h-4 w-4 text-blue-500 shrink-0" />}
            {docType === "other" && <File className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-semibold truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={url} download={name} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Descargar
              </Button>
            </a>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Viewer area */}
        <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center">
          {docType === "pdf" && (
            <iframe
              src={url}
              title={name}
              className="w-full h-full border-0"
              allow="fullscreen"
            />
          )}
          {docType === "image" && (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {docType === "other" && (
            <div className="flex flex-col items-center gap-4 text-center p-10">
              <File className="h-16 w-16 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">Este tipo de archivo no tiene vista previa.</p>
              <a href={url} download={name} target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-1.5">
                  <Download className="h-4 w-4" /> Descargar archivo
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
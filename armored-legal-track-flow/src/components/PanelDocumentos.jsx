import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload, FileText, Image, File, Download, Trash2,
  Loader2, FolderOpen
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DocViewer from "@/components/DocViewer";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function getMime(file) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", zip: "application/zip" };
  return map[ext] || "otro";
}

export default function PanelDocumentos({ macroProcessId }) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const fileRef = useRef();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs_expediente", macroProcessId],
    queryFn: () => base44.entities.DocumentoExpediente.filter({ macro_process_id: macroProcessId, actuacion_id: null }),
    enabled: !!macroProcessId,
  });

  // Also get docs where actuacion_id is undefined/null using the filter
  const { data: allDocs = [] } = useQuery({
    queryKey: ["docs_expediente_all", macroProcessId],
    queryFn: () => base44.entities.DocumentoExpediente.filter({ macro_process_id: macroProcessId }),
    enabled: !!macroProcessId,
  });

  // Filter general docs (no actuacion)
  const generalDocs = allDocs.filter(d => !d.actuacion_id);

  const delMut = useMutation({
    mutationFn: (id) => base44.entities.DocumentoExpediente.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs_expediente_all", macroProcessId] });
      toast.success("Documento eliminado");
    },
  });

  const uploadFiles = useCallback(async (files) => {
    const arr = Array.from(files);
    const oversized = arr.filter(f => f.size > MAX_BYTES);
    if (oversized.length > 0) {
      toast.error(`Archivo demasiado grande: "${oversized[0].name}" supera el límite de 10 MB.`);
      return;
    }
    setUploading(true);
    for (const file of arr) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.DocumentoExpediente.create({
        macro_process_id: macroProcessId,
        actuacion_id: null,
        nombre_original: file.name,
        tipo_mime: getMime(file),
        peso_bytes: file.size,
        url_storage: file_url,
      });
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["docs_expediente_all", macroProcessId] });
    toast.success(`${arr.length} documento${arr.length !== 1 ? "s" : ""} subido${arr.length !== 1 ? "s" : ""}`);
  }, [macroProcessId, qc]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          cursor-pointer transition-all min-h-[100px] px-4 py-5 text-center
          ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}
        `}
      >
        {uploading ? (
          <><Loader2 className="h-6 w-6 text-primary animate-spin" /><p className="text-xs text-muted-foreground">Subiendo...</p></>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">Arrastra archivos aquí o haz clic</p>
            <p className="text-[10px] text-muted-foreground/60">PDF, imágenes, ZIP · Máx. 10 MB por archivo</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.zip" className="hidden" onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }} />

      {/* File list */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-1.5">
        {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>}
        {!isLoading && generalDocs.length === 0 && (
          <div className="text-center py-8">
            <FolderOpen className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Sin documentos generales aún</p>
          </div>
        )}
        {generalDocs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 group transition-colors"
          >
            <span className="shrink-0">{fileIcon(doc.tipo_mime)}</span>
            <button
              className="flex-1 min-w-0 text-left"
              onClick={() => setViewerDoc({ url: doc.url_storage, name: doc.nombre_original, mime: doc.tipo_mime })}
            >
              <p className="text-xs font-medium truncate hover:text-primary transition-colors">{doc.nombre_original}</p>
              {doc.peso_bytes && <p className="text-[10px] text-muted-foreground">{formatBytes(doc.peso_bytes)}</p>}
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <a href={doc.url_storage} download={doc.nombre_original} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                  <Download className="h-3 w-3" />
                </Button>
              </a>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                    <AlertDialogDescription>"{doc.nombre_original}" se eliminará permanentemente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => delMut.mutate(doc.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <DocViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}
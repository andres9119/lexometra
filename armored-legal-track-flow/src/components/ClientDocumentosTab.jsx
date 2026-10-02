/**
 * ClientDocumentosTab — Gestor de anexos documentales en estilo High-Density ERP.
 * Se integra directamente en la Ficha Comercial (FichaTab).
 */
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Upload, Eye, Download, Trash2, FileText, X, Loader2 } from "lucide-react";

const TIPOS_DOCUMENTO = [
  "Cédula de Ciudadanía",
  "Reporte Centrales de Riesgo",
  "Soporte de Pago",
  "Contrato Firmado",
  "Poder Notarial",
  "Petición Radicada",
  "Respuesta Entidad",
  "Tutela",
  "Sentencia / Fallo",
  "Otro",
];

function fmtBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}

function getFileIcon(mime) {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("excel") || mime.includes("sheet")) return "📊";
  if (mime.includes("zip")) return "🗜️";
  return "📄";
}

// ── Modal de subida ───────────────────────────────────────────────────────────
function UploadModal({ clientId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [tipo, setTipo] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleSubmit = async () => {
    if (!file) { toast.error("Selecciona un archivo"); return; }
    if (!tipo) { toast.error("Selecciona el tipo de documento"); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.ClientDocument.create({
        client_id: clientId,
        tipo_documento: tipo,
        nombre_original: file.name,
        url_storage: file_url,
        peso_bytes: file.size,
        tipo_mime: file.type || "otro",
        uploaded_by_name: me?.full_name || me?.email || "Usuario",
      });
      toast.success("Documento cargado exitosamente");
      onSuccess();
    } catch (err) {
      toast.error("Error al subir el archivo: " + (err?.message || "Intenta de nuevo"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border border-gray-400 shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between bg-gray-700 text-white px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-widest">Subir Documento</span>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Tipo de documento */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
              Tipo de Documento <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full text-[11px] border border-gray-400 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-500 bg-white"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
            >
              <option value="">— Seleccionar tipo —</option>
              {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Dropzone */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
              Archivo <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                dragging ? "border-gray-500 bg-gray-100" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <input ref={inputRef} type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">{getFileIcon(file.type)}</span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-gray-800 truncate max-w-[260px]">{file.name}</p>
                    <p className="text-[10px] text-gray-500">{fmtBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-[11px] text-gray-600 font-semibold">Arrastra aquí o haz clic para seleccionar</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">PDF, JPG, PNG, DOCX, XLSX — máx. 25 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
            <button
              onClick={onClose}
              className="text-[11px] font-semibold px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading || !file || !tipo}
              className="text-[11px] font-semibold px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo...</> : <><Upload className="h-3.5 w-3.5" /> Subir Documento</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ClientDocumentosTab({ clientId }) {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["client_docs", clientId],
    queryFn: () => base44.entities.ClientDocument.filter({ client_id: clientId }, "-created_date"),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId) => base44.entities.ClientDocument.delete(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_docs", clientId] });
      toast.success("Documento eliminado");
    },
    onError: (err) => toast.error("Error al eliminar: " + (err?.message || "Intenta de nuevo")),
  });

  const handleUploadSuccess = () => {
    setShowUpload(false);
    qc.invalidateQueries({ queryKey: ["client_docs", clientId] });
  };

  const handleDelete = (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre_original}"? Esta acción no se puede deshacer.`)) return;
    deleteDoc.mutate(doc.id);
  };

  return (
    <div className="mt-2">
      {/* Cabecera de sección */}
      <div className="flex items-center justify-between bg-gray-700 text-white px-2 py-1 border border-gray-500">
        <span className="text-[10px] font-bold uppercase tracking-widest">
          V. Documentos Anexos ({docs.length})
        </span>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-500 hover:bg-gray-400 text-white transition-colors"
        >
          <Upload className="h-3 w-3" /> + Subir Documento
        </button>
      </div>

      {/* Tabla de documentos */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-400 text-[11px]">
          <thead>
            <tr className="bg-gray-200">
              {["#", "Tipo de Documento", "Nombre del Archivo", "Tamaño", "Fecha de Carga", "Acciones"].map((h, i) => (
                <th
                  key={h}
                  className={`border border-gray-400 px-2 py-1 text-[10px] font-bold uppercase text-gray-700 whitespace-nowrap ${
                    i === 0 ? "w-8 text-center" : i === 5 ? "w-28 text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="border border-gray-400 px-2 py-4 text-center text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-1" /> Cargando documentos...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-gray-400 px-2 py-5 text-center text-gray-400 italic">
                  <FileText className="h-4 w-4 inline-block mr-1.5 opacity-50" />
                  Sin documentos anexos registrados — usa "+ Subir Documento" para agregar
                </td>
              </tr>
            ) : docs.map((doc, idx) => (
              <tr key={doc.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-400 px-2 py-1 text-center text-gray-500 w-8">{idx + 1}</td>
                <td className="border border-gray-400 px-2 py-1">
                  <span className="inline-block bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0 text-[10px] font-semibold uppercase">
                    {doc.tipo_documento || "—"}
                  </span>
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{getFileIcon(doc.tipo_mime)}</span>
                    <span className="font-mono text-gray-800 truncate max-w-[220px]" title={doc.nombre_original}>
                      {doc.nombre_original}
                    </span>
                  </div>
                </td>
                <td className="border border-gray-400 px-2 py-1 font-mono text-gray-600 whitespace-nowrap">
                  {fmtBytes(doc.peso_bytes)}
                </td>
                <td className="border border-gray-400 px-2 py-1 font-mono text-gray-600 whitespace-nowrap">
                  {fmtDate(doc.created_date)}
                </td>
                <td className="border border-gray-400 px-2 py-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <a
                      href={doc.url_storage}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver documento"
                      className="text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={doc.url_storage}
                      download={doc.nombre_original}
                      title="Descargar"
                      className="text-gray-500 hover:text-green-600 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      title="Eliminar"
                      disabled={deleteDoc.isPending}
                      className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de subida */}
      {showUpload && (
        <UploadModal
          clientId={clientId}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Paperclip, X, Loader2, Plus, AlertTriangle } from "lucide-react";

// ── Stage name dictionaries by process type ──────────────────────────────────
const STAGE_NAMES = {
  tutela: [
    "Radicación",
    "Admisión",
    "Inadmisión",
    "Rechazo",
    "Traslado y Contestación",
    "Decreto de Pruebas",
    "Fallo Primera Instancia",
    "Impugnación",
    "Fallo Segunda Instancia",
    "Incidente de Desacato",
  ],
  peticion: [
    "Radicación de Petición",
    "Acuse de Recibo",
    "Respuesta en Término",
    "Respuesta Extemporánea",
    "Silencio Administrativo",
    "Recurso de Insistencia",
    "Cierre",
  ],
  recurso: [
    "Interposición del Recurso",
    "Admisión",
    "Traslado al Recurrido",
    "Decreto de Pruebas",
    "Alegatos de Conclusión",
    "Fallo del Recurso",
    "Ejecutoria",
  ],
  queja_sic: [
    "Radicación ante SIC",
    "Admisión de la Queja",
    "Traslado a la Empresa",
    "Respuesta de la Empresa",
    "Investigación Preliminar",
    "Pliego de Cargos",
    "Descargos",
    "Resolución Sancionatoria",
    "Recurso de Reposición",
    "Resolución Definitiva",
  ],
  demanda: [
    "Presentación de la Demanda",
    "Admisión",
    "Notificación al Demandado",
    "Contestación de la Demanda",
    "Audiencia Inicial",
    "Audiencia de Instrucción y Juzgamiento",
    "Sentencia",
    "Apelación",
    "Fallo de Segunda Instancia",
    "Ejecutoria de la Sentencia",
    "Proceso Ejecutivo",
  ],
  otro: [
    "Inicio",
    "En trámite",
    "Resolución",
    "Cierre",
  ],
};

const DEFAULT_STAGES = STAGE_NAMES.tutela;
const MANUAL_OPTION = "__manual__";

const empty = {
  stage_name: "",
  date: "",
  term_deadline: "",
  description: "",
  status: "pendiente",
  order: 0,
  attachments: [],
};

export default function StageForm({ open, onOpenChange, stage, processId, processType, onSuccess }) {
  const [form, setForm]             = useState(empty);
  const [selectedOption, setSelectedOption] = useState("");
  const [manualName, setManualName] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]); // files selected but not yet uploaded
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  const stageOptions = STAGE_NAMES[processType] || DEFAULT_STAGES;

  useEffect(() => {
    if (!open) return;
    const base = stage ? { ...empty, ...stage } : { ...empty };
    // sanitize nulls
    const sanitized = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v ?? (k === "attachments" ? [] : "")]));
    setForm(sanitized);

    // pre-select dropdown when editing
    if (stage?.stage_name) {
      if (stageOptions.includes(stage.stage_name)) {
        setSelectedOption(stage.stage_name);
        setManualName("");
      } else {
        setSelectedOption(MANUAL_OPTION);
        setManualName(stage.stage_name);
      }
    } else {
      setSelectedOption("");
      setManualName("");
    }
    setPendingFiles([]);
  }, [open, stage]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSelectStage = (val) => {
    setSelectedOption(val);
    if (val !== MANUAL_OPTION) {
      set("stage_name", val);
      setManualName("");
    } else {
      set("stage_name", "");
    }
  };

  // Track pending files before upload
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const removePending = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const mutation = useMutation({
    mutationFn: async (d) => {
      // Upload pending files now
      let newAttachments = [...(d.attachments || [])];
      if (pendingFiles.length > 0) {
        setUploading(true);
        for (const file of pendingFiles) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          newAttachments.push({ name: file.name, url: file_url });
        }
        setUploading(false);
      }
      const payload = { ...d, attachments: newAttachments };
      return stage
        ? base44.entities.ProcessStage.update(stage.id, payload)
        : base44.entities.ProcessStage.create({ ...payload, process_id: processId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", processId] });
      toast.success(stage ? "Etapa actualizada" : "Etapa registrada");
      onSuccess?.();
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const removeAttachment = (idx) => set("attachments", form.attachments.filter((_, i) => i !== idx));

  const submit = (e) => {
    e.preventDefault();
    const finalName = selectedOption === MANUAL_OPTION ? manualName.trim() : form.stage_name;
    if (!finalName) { toast.error("El nombre de la etapa es requerido"); return; }
    mutation.mutate({ ...form, stage_name: finalName });
  };

  // Deadline warning for display
  const showDeadlineWarning = (() => {
    if (!form.term_deadline) return null;
    const days = Math.ceil((new Date(form.term_deadline) - new Date()) / 86400000);
    if (days < 0) return { text: "Término vencido", cls: "text-red-600 bg-red-50 border-red-200" };
    if (days === 0) return { text: "Vence hoy", cls: "text-red-600 bg-red-50 border-red-200" };
    if (days <= 5) return { text: `Vence en ${days} día${days !== 1 ? "s" : ""}`, cls: "text-orange-600 bg-orange-50 border-orange-200" };
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{stage ? "Editar Etapa" : "Nueva Etapa Procesal"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-1">

          {/* ── Stage name: dynamic select ── */}
          <div className="space-y-1.5">
            <Label>Nombre de la etapa *</Label>
            <Select value={selectedOption} onValueChange={handleSelectStage}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar actuación..." />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
                <SelectItem value={MANUAL_OPTION}>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" /> Agregar nombre manual
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {selectedOption === MANUAL_OPTION && (
              <Input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Escribe el nombre de la actuación..."
                autoFocus
                className="mt-1.5"
              />
            )}
          </div>

          {/* ── Dates row ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha de actuación</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vencimiento del término</Label>
              <Input type="date" value={form.term_deadline} onChange={e => set("term_deadline", e.target.value)} />
              {showDeadlineWarning && (
                <p className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border w-fit ${showDeadlineWarning.cls}`}>
                  <AlertTriangle className="h-2.5 w-2.5" />{showDeadlineWarning.text}
                </p>
              )}
            </div>
          </div>

          {/* ── Status + Order ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="en_curso">En curso</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Orden</Label>
              <Input type="number" value={form.order} onChange={e => set("order", parseInt(e.target.value) || 0)} />
            </div>
          </div>

          {/* ── Description ── */}
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Describa la actuación realizada..." />
          </div>

          {/* ── Document upload ── */}
          <div className="space-y-1.5">
            <Label>Documento de Actuación</Label>
            <div className="space-y-2">
              {/* Already saved attachments */}
              {(form.attachments || []).map((att, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={att.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline text-primary text-xs">{att.name}</a>
                  <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {/* Pending files (selected but not yet uploaded) */}
              {pendingFiles.map((file, i) => (
                <div key={`pending-${i}`} className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1 truncate text-xs text-amber-700 font-medium">{file.name}</span>
                  <span className="text-[10px] text-amber-500 shrink-0">Pendiente</span>
                  <button type="button" onClick={() => removePending(i)} className="text-amber-400 hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Subiendo...</>
                  : <><Paperclip className="h-3.5 w-3.5 mr-1.5" />Adjuntar PDF o imagen</>
                }
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending || uploading ? "Guardando..." : stage ? "Actualizar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
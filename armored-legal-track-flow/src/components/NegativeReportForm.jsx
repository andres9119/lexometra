import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import EntityCombobox from "@/components/EntityCombobox";
import { toTitleCase } from "@/utils/titleCase";
import { useObligationStatuses } from "@/hooks/useObligationStatuses";

const EMPTY = {
  entity_name: "", entity_nit: "", entity_dv: "", obligation_number: "", pending_amount: "",
  obligation_status: "MORA",
  has_negative_permanence: false, negative_permanence_until: "",
  status: "pendiente", notes: "",
};



const formatCurrency = (value) => {
  if (!value && value !== 0) return "";
  const num = parseFloat(String(value).replace(/[^\d]/g, "")) || 0;
  return num === 0 ? "" : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(num);
};

const Lbl = ({ children }) => (
  <div className="bg-gray-200 border-r border-gray-400 px-2 flex items-center min-h-[32px]">
    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-700 whitespace-normal">{children}</span>
  </div>
);

const Val = ({ children, className = "" }) => (
  <div className={`bg-white border-r border-gray-400 flex items-center min-h-[32px] ${className}`}>
    {children}
  </div>
);

const inp = "w-full h-full bg-transparent border-none focus:ring-0 focus:outline-none px-2 py-1 text-xs text-gray-900 placeholder-gray-400";

export default function NegativeReportForm({ open, onOpenChange, clientId, onSuccess, editingReport }) {
  const [form, setForm] = useState(EMPTY);
  const [editingStatus, setEditingStatus] = useState(false);
  const { statuses: statusList, updateStatuses } = useObligationStatuses();
  const [newStatus, setNewStatus] = useState({ value: "", label: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addStatus = () => {
    if (!newStatus.value.trim() || !newStatus.label.trim()) return toast.error("Ingrese valor y etiqueta");
    if (statusList.some(s => s.value === newStatus.value)) return toast.error("Este estado ya existe");
    updateStatuses([...statusList, newStatus]);
    setNewStatus({ value: "", label: "" });
    toast.success("Estado agregado");
  };

  const removeStatus = (value) => {
    updateStatuses(statusList.filter(s => s.value !== value));
  };

  const updateStatusLabel = (value, newLabel) => {
    updateStatuses(statusList.map(s => s.value === value ? { ...s, label: newLabel } : s));
  };

  const onDragEnd = ({ source, destination }) => {
    if (!destination || source.index === destination.index) return;
    const newList = [...statusList];
    const [moved] = newList.splice(source.index, 1);
    newList.splice(destination.index, 0, moved);
    updateStatuses(newList);
  };

  // Cargar reporte al abrirse
  useEffect(() => {
    if (editingReport) {
      setForm({
        entity_name: editingReport.entity_name || "",
        entity_nit: editingReport.entity_nit || "",
        entity_dv: editingReport.entity_dv || "",
        obligation_number: editingReport.obligation_number || "",
        pending_amount: editingReport.pending_amount || "",
        obligation_status: editingReport.obligation_status || "MORA",
        has_negative_permanence: editingReport.has_negative_permanence || false,
        negative_permanence_until: editingReport.negative_permanence_until || "",
        status: editingReport.status || "pendiente",
        notes: editingReport.notes || "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [editingReport, open]);

  const mutation = useMutation({
    mutationFn: async (d) => {
      const cleanName = toTitleCase(d.entity_name.trim());
      const payload = {
        entity_name: cleanName,
        entity_nit: d.entity_nit || "",
        entity_dv: d.entity_dv || "",
        obligation_number: d.obligation_number || "",
        pending_amount: parseFloat(d.pending_amount) || 0,
        obligation_status: d.obligation_status || "MORA",
        has_negative_permanence: d.has_negative_permanence || false,
        negative_permanence_until: d.negative_permanence_until || "",
        status: d.status || "pendiente",
        notes: d.notes || "",
      };
      if (editingReport) {
        return base44.entities.ClientNegativeReport.update(editingReport.id, payload);
      } else {
        return base44.entities.ClientNegativeReport.create({ client_id: clientId, ...payload });
      }
    },
    onSuccess: () => {
      toast.success(editingReport ? "Reporte actualizado" : "Reporte registrado");
      setForm(EMPTY);
      onSuccess?.();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.entity_name.trim()) return toast.error("Debe seleccionar una entidad del directorio");
    mutation.mutate(form);
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-700 border-b border-gray-500 sticky top-0 z-10">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            {editingReport ? "Editar Reporte Negativo" : "Agregar Reporte Negativo"}
          </span>
          <button onClick={() => onOpenChange(false)} className="text-white hover:text-gray-300 text-lg">×</button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3 bg-white">

          {/* Fila 1: Entidad */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">Identificación de Obligación</span>
            </div>
            <div className="border-l border-t border-r border-b border-gray-400 grid grid-cols-4">
              <Lbl>Entidad / Razón Social *</Lbl>
              <Val className="col-span-3">
                <EntityCombobox
                  entityName={form.entity_name}
                  entityNit={form.entity_nit}
                  entityDv={form.entity_dv}
                  onSelect={({ razon_social, nit, dv }) => setForm(p => ({ ...p, entity_name: razon_social, entity_nit: nit, entity_dv: dv }))}
                  className="!border-none !bg-transparent !px-2"
                />
              </Val>

              <Lbl>NIT</Lbl>
              <Val>
                <input className={inp + " font-mono"} value={form.entity_nit} onChange={e => set("entity_nit", e.target.value)} placeholder="900.123.456" autoComplete="off" />
              </Val>
              <Lbl>DV</Lbl>
              <Val>
                <input className={inp + " font-mono"} value={form.entity_dv} onChange={e => set("entity_dv", e.target.value)} placeholder="0" maxLength={1} autoComplete="off" />
              </Val>

              <Lbl>No. Obligación</Lbl>
              <Val>
                <input className={inp + " font-mono"} value={form.obligation_number} onChange={e => set("obligation_number", e.target.value)} placeholder="Ej: 706404581" autoComplete="off" />
              </Val>
              <Lbl>Saldo Pendiente<br /><span className="font-normal text-gray-500 text-[9px]">(informativo)</span></Lbl>
              <Val>
                <input className={inp + " font-mono"} type="text" inputMode="decimal" value={form.pending_amount ? formatCurrency(form.pending_amount) : ""} onChange={e => { const clean = e.target.value.replace(/[^\d]/g, ""); set("pending_amount", clean); }} placeholder="0.00" autoComplete="off" />
              </Val>

              <Lbl className="flex items-center justify-between gap-1">
                <span>Estado de Obligación</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-gray-300"
                  onClick={() => setEditingStatus(!editingStatus)}
                  title="Editar estados"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </Lbl>
              <Val className="col-span-3">
                {!editingStatus ? (
                  <Select value={form.obligation_status} onValueChange={v => set("obligation_status", v)}>
                    <SelectTrigger className="!border-none !bg-transparent h-full focus:ring-0 focus:outline-none">
                      <SelectValue placeholder="— Seleccionar —" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value={null}>— Seleccionar —</SelectItem>
                      {statusList.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="w-full h-full bg-slate-50 border border-gray-300 rounded p-2 overflow-y-auto text-xs">
                    <div className="font-semibold text-slate-700 mb-2 text-[10px]">Editar estados (arrastra para reordenar)</div>
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="status-list">
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-32 overflow-y-auto space-y-1">
                            {statusList.map((s, idx) => (
                              <Draggable key={s.value} draggableId={s.value} index={idx}>
                                {(p, snapshot) => (
                                  <div
                                    ref={p.innerRef}
                                    {...p.draggableProps}
                                    {...p.dragHandleProps}
                                    className={`flex justify-between items-center gap-1 text-[10px] p-1 rounded border cursor-grab active:cursor-grabbing select-none ${snapshot.isDragging ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}
                                  >
                                    <span className="shrink-0 text-gray-400">☰</span>
                                    <input
                                      className="flex-1 text-[10px] border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                                      value={s.label}
                                      onChange={e => updateStatusLabel(s.value, e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      onMouseDown={e => e.stopPropagation()}
                                    />
                                    <Button type="button" size="sm" variant="destructive" className="h-5 w-5 p-0 shrink-0 text-[10px]" onClick={() => removeStatus(s.value)}>−</Button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                    <div className="space-y-1 pt-2 border-t border-gray-300 mt-2">
                      <Input placeholder="Código" value={newStatus.value} onChange={e => setNewStatus({...newStatus, value: e.target.value})} className="text-[10px] h-6" />
                      <Input placeholder="Etiqueta" value={newStatus.label} onChange={e => setNewStatus({...newStatus, label: e.target.value})} className="text-[10px] h-6" />
                      <Button type="button" size="sm" className="w-full text-[10px] h-6" onClick={addStatus}>+ Agregar</Button>
                    </div>
                  </div>
                )}
              </Val>

              <Lbl>¿Permanencia Negativa?</Lbl>
              <Val className="col-span-3">
                <Select value={form.has_negative_permanence ? "si" : "no"} onValueChange={v => set("has_negative_permanence", v === "si")}>
                  <SelectTrigger className="!border-none !bg-transparent h-full focus:ring-0 focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </Val>

              {form.has_negative_permanence && (
                <>
                  <Lbl>Hasta el</Lbl>
                  <Val className="col-span-3">
                    <input className={inp} type="date" value={form.negative_permanence_until} onChange={e => set("negative_permanence_until", e.target.value)} autoComplete="off" />
                  </Val>
                </>
              )}

              <Lbl>Notas</Lbl>
              <Val className="col-span-3 h-auto">
                <textarea className={inp + " resize-none"} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones adicionales..." autoComplete="off" />
              </Val>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando..." : editingReport ? "Actualizar" : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
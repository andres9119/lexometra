import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { formatNIT, getNITDigits } from "@/utils/nitFormat";
import EmailListInput from "@/components/EmailListInput";

const COMPLEJIDAD_LABELS = {
  1: { label: "Baja",      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  2: { label: "Media-Baja", color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  3: { label: "Media",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  4: { label: "Alta",      color: "text-orange-600",  bg: "bg-orange-50 border-orange-200" },
  5: { label: "Muy Alta",  color: "text-red-600",     bg: "bg-red-50 border-red-200" },
};

const EMPTY_FORM = { razon_social: "", nit: "", dv: "", emails: [], complejidad: null, notas: "" };

export default function EntidadCreateModal({ open, onOpenChange, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [hover, setHover] = useState(null);

  const validate = () => {
    const e = {};
    if (!form.razon_social.trim()) e.razon_social = "Obligatorio";
    if (!getNITDigits(form.nit).trim()) e.nit = "Obligatorio";
    if (!form.dv.trim()) e.dv = "Obligatorio";
    if (!form.emails.length) e.emails = "Obligatorio";
    if (!form.complejidad) e.complejidad = "Obligatorio";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DirectorioEntidad.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorio_entidades"] });
      toast.success("Entidad creada en el directorio");
      setForm(EMPTY_FORM);
      setErrors({});
      onSuccess?.();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const nitDigits = getNITDigits(form.nit);
    createMutation.mutate({
      razon_social: form.razon_social.trim().toUpperCase(),
      nit: `${nitDigits}-${form.dv.trim()}`,
      emails: form.emails,
      complejidad: form.complejidad,
      notas: form.notas.trim() || undefined,
    });
  };

  const activeLevel = hover ?? form.complejidad;
  const cfg = activeLevel ? COMPLEJIDAD_LABELS[activeLevel] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(EMPTY_FORM); setErrors({}); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Entidad</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Razón Social */}
          <div>
            <Label>Razón Social *</Label>
            <Input
              value={form.razon_social}
              onChange={e => setForm(p => ({ ...p, razon_social: e.target.value }))}
              placeholder="Nombre de la entidad"
              className={`uppercase ${errors.razon_social ? "border-red-400" : ""}`}
            />
            {errors.razon_social && <p className="text-[10px] text-red-500 mt-0.5">{errors.razon_social}</p>}
          </div>

          {/* NIT + DV */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-10">
              <Label>NIT *</Label>
              <Input
                value={form.nit}
                onChange={e => setForm(p => ({ ...p, nit: formatNIT(e.target.value) }))}
                placeholder="Ej: 900.123.456"
                className={`font-mono ${errors.nit ? "border-red-400" : ""}`}
              />
              {errors.nit && <p className="text-[10px] text-red-500 mt-0.5">{errors.nit}</p>}
            </div>
            <div className="col-span-2">
              <Label>DV *</Label>
              <Input
                value={form.dv}
                onChange={e => { const v = e.target.value.slice(0, 1); if (/^\d?$/.test(v)) setForm(p => ({ ...p, dv: v })); }}
                placeholder="0"
                maxLength="1"
                className={`font-mono text-center ${errors.dv ? "border-red-400" : ""}`}
              />
              {errors.dv && <p className="text-[10px] text-red-500 mt-0.5">{errors.dv}</p>}
            </div>
          </div>

          {/* Emails */}
          <div>
            <Label className="mb-1.5 block">Correo(s) electrónico(s) *</Label>
            <EmailListInput
              emails={form.emails}
              onChange={v => setForm(p => ({ ...p, emails: v }))}
              required={!!errors.emails}
            />
          </div>

          {/* Complejidad */}
          <div>
            <Label className="mb-2 block">Nivel de Complejidad *</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(level => (
                <button key={level} type="button"
                  onMouseEnter={() => setHover(level)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setForm(p => ({ ...p, complejidad: p.complejidad === level ? null : level }))}
                  className="transition-transform hover:scale-110">
                  <Star className={`h-7 w-7 transition-colors ${level <= (activeLevel ?? 0) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-100"}`} />
                </button>
              ))}
              {cfg && <span className={`ml-3 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>}
              {!cfg && <span className="ml-3 text-xs text-muted-foreground">Sin calificación</span>}
            </div>
            {errors.complejidad && <p className="text-[10px] text-red-500 mt-1">{errors.complejidad}</p>}
          </div>

          {/* Notas */}
          <div>
            <Label>Notas internas</Label>
            <Textarea
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              placeholder="Observaciones, contactos, comportamiento histórico..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Guardando..." : "Crear Entidad"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
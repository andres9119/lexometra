import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star } from "lucide-react";
import EmailListInput from "@/components/EmailListInput";

const COMPLEJIDAD_LABELS = {
  1: { label: "Baja",      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  2: { label: "Media-Baja", color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  3: { label: "Media",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  4: { label: "Alta",      color: "text-orange-600",  bg: "bg-orange-50 border-orange-200" },
  5: { label: "Muy Alta",  color: "text-red-600",     bg: "bg-red-50 border-red-200" },
};

export default function EntidadEditModal({ open, onOpenChange, entidad, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ razon_social: "", nit: "", emails: [], complejidad: null, notas: "" });
  const [hover, setHover] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (entidad) {
      setForm({
        razon_social: entidad.razon_social || "",
        nit: entidad.nit || "",
        emails: entidad.emails || [],
        complejidad: entidad.complejidad || null,
        notas: entidad.notas || "",
      });
    }
  }, [entidad]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Actualizar la entidad en el directorio
      await base44.entities.DirectorioEntidad.update(entidad.id, data);

      // 2. Si cambió la razón social, propagar a todos los reportes negativos que la referencian
      if (data.razon_social !== entidad.razon_social) {
        const reportes = await base44.entities.ClientNegativeReport.filter({ entity_name: entidad.razon_social });
        await Promise.all(
          reportes.map(r =>
            base44.entities.ClientNegativeReport.update(r.id, { entity_name: data.razon_social })
          )
        );
        return reportes.length;
      }
      return 0;
    },
    onSuccess: (propagated) => {
      qc.invalidateQueries({ queryKey: ["directorio_entidades"] });
      qc.invalidateQueries({ queryKey: ["reports"] }); // invalida todos los reportes en caché
      toast.success(
        propagated > 0
          ? `Entidad actualizada y propagada a ${propagated} reporte${propagated !== 1 ? "s" : ""} en curso`
          : "Entidad actualizada correctamente"
      );
      onSuccess?.();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.razon_social.trim()) return toast.error("La razón social es requerida");
    setShowConfirm(true);
  };

  const activeLevel = hover ?? form.complejidad;
  const cfg = activeLevel ? COMPLEJIDAD_LABELS[activeLevel] : null;

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará la información de <strong>{form.razon_social}</strong>. Si cambió la razón social, se propagará a todos los reportes vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); updateMutation.mutate(form); }}>
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Entidad</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-1">
            <div>
              <Label>Razón Social *</Label>
              <Input
                value={form.razon_social}
                onChange={e => setForm(p => ({ ...p, razon_social: e.target.value }))}
                placeholder="Nombre de la entidad"
              />
            </div>

            <div>
              <Label>NIT</Label>
              <Input
                value={form.nit}
                onChange={e => setForm(p => ({ ...p, nit: e.target.value }))}
                placeholder="Ej: 900.123.456"
                className="font-mono"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Correo(s) electrónico(s)</Label>
              <EmailListInput
                emails={form.emails}
                onChange={v => setForm(p => ({ ...p, emails: v }))}
              />
            </div>

            {/* Nivel de complejidad */}
            <div>
              <Label className="mb-2 block">Nivel de Complejidad</Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    type="button"
                    onMouseEnter={() => setHover(level)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setForm(p => ({ ...p, complejidad: p.complejidad === level ? null : level }))}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        level <= (activeLevel ?? 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-200 fill-gray-100"
                      }`}
                    />
                  </button>
                ))}
                {cfg && (
                  <span className={`ml-3 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                )}
                {!cfg && (
                  <span className="ml-3 text-xs text-muted-foreground">Sin calificación</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                1 = Baja dificultad · 5 = Muy alta dificultad de gestión
              </p>
            </div>

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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
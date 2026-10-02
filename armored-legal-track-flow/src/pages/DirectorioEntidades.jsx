import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { Building2, Search, Trash2, Pencil, Star, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import EntidadEditModal from "@/components/EntidadEditModal";
import EntidadCreateModal from "@/components/EntidadCreateModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const COMPLEJIDAD_CONFIG = {
  1: { label: "Baja",       color: "bg-emerald-100 text-emerald-700" },
  2: { label: "Media-Baja", color: "bg-teal-100 text-teal-700" },
  3: { label: "Media",      color: "bg-amber-100 text-amber-700" },
  4: { label: "Alta",       color: "bg-orange-100 text-orange-700" },
  5: { label: "Muy Alta",   color: "bg-red-100 text-red-700" },
};

function StarRating({ value }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= value ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-100"}`}
        />
      ))}
    </div>
  );
}

export default function DirectorioEntidades() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingEntidad, setEditingEntidad] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingEntidad, setDeletingEntidad] = useState(null);

  const { data: entidades = [], isLoading } = useQuery({
    queryKey: ["directorio_entidades"],
    queryFn: () => base44.entities.DirectorioEntidad.list("razon_social"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DirectorioEntidad.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorio_entidades"] });
      toast.success("Entidad eliminada del directorio");
    },
  });

  const filtered = entidades.filter(e =>
    !search ||
    e.razon_social?.toLowerCase().includes(search.toLowerCase()) ||
    e.nit?.includes(search)
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">DIRECTORIO DE ENTIDADES</span>
          <span className="text-sidebar-foreground/50 text-xs font-mono bg-sidebar-accent px-2 py-0.5 rounded-full">{entidades.length} registros</span>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva Entidad
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o NIT..."
            className="pl-9 h-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {filtered.length} entidad{filtered.length !== 1 ? "es" : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-14">
              <div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground text-sm">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {search ? "No se encontraron entidades con ese criterio" : "El directorio está vacío"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/10">
                    <th className="px-4 py-2.5 text-center w-10">#</th>
                    <th className="px-4 py-2.5 text-left">Razón Social</th>
                    <th className="px-4 py-2.5 text-left">NIT</th>
                    <th className="px-4 py-2.5 text-center">Complejidad</th>
                    <th className="px-4 py-2.5 text-left">Correo</th>
                    <th className="px-4 py-2.5 text-left max-w-xs">Notas</th>
                    <th className="px-4 py-2.5 text-left">Fecha Registro</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => {
                    const cfg = e.complejidad ? COMPLEJIDAD_CONFIG[e.complejidad] : null;
                    return (
                      <tr key={e.id} className={"border-t border-border/50 hover:bg-secondary/40 transition-colors group " + (idx % 2 !== 0 ? "bg-muted/10" : "")}>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-sm uppercase">{e.razon_social}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.nit || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StarRating value={e.complejidad} />
                            {cfg && (
                              <span className={"px-1.5 py-0.5 rounded text-[10px] font-bold " + cfg.color}>{cfg.label}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                         {e.emails?.length > 0
                           ? <div className="flex flex-col gap-0.5">{e.emails.map((m, i) => <span key={i} className="font-mono">{m}</span>)}</div>
                           : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                         {e.notas
                            ? <span className="line-clamp-2">{e.notas}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {e.created_date ? new Date(e.created_date).toLocaleDateString("es-CO") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => setEditingEntidad(e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                             variant="ghost" size="icon"
                             className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-red-50"
                             onClick={() => setDeletingEntidad(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmación eliminación */}
      <AlertDialog open={!!deletingEntidad} onOpenChange={(v) => { if (!v) setDeletingEntidad(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entidad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deletingEntidad?.razon_social}</strong> del directorio. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => { deleteMutation.mutate(deletingEntidad.id); setDeletingEntidad(null); }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EntidadCreateModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={() => setShowCreate(false)}
      />

      <EntidadEditModal
        open={!!editingEntidad}
        onOpenChange={(v) => { if (!v) setEditingEntidad(null); }}
        entidad={editingEntidad}
        onSuccess={() => {
          setEditingEntidad(null);
          qc.invalidateQueries({ queryKey: ["directorio_entidades"] });
        }}
      />
    </div>
  );
}
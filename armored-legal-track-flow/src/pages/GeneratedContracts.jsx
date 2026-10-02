import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Eye, Trash2, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS = {
  borrador:    "bg-slate-100 text-slate-600",
  revisado:    "bg-amber-100 text-amber-700",
  formalizado: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABELS = { borrador: "Borrador", revisado: "Revisado", formalizado: "Formalizado" };

export default function GeneratedContracts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["generated_contracts"],
    queryFn: () => base44.entities.GeneratedContract.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GeneratedContract.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["generated_contracts"] }); toast.success("Documento eliminado"); },
  });

  const filtered = contracts.filter(c =>
    !search ||
    c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_cc?.includes(search) ||
    c.template_name?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy", { locale: es }); } catch { return d; } };

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Documentos Generados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Contratos y acuerdos generados para tus clientes</p>
        </div>
        <div className="flex gap-2">
          <Link to="/contracts/templates">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Plantillas
            </Button>
          </Link>
          <Link to="/contracts/new">
            <Button size="sm" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo Documento
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="pl-8 text-sm h-9" placeholder="Buscar por cliente o plantilla..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1">{search ? "Sin resultados" : "Sin documentos generados"}</p>
          {!search && <Link to="/contracts/new"><Button size="sm" className="mt-2"><Plus className="h-3.5 w-3.5 mr-1.5" /> Generar primer documento</Button></Link>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left">Fecha</th>
                <th className="px-4 py-2.5 text-left">Cliente</th>
                <th className="px-4 py-2.5 text-left">CC</th>
                <th className="px-4 py-2.5 text-left">Plantilla</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} className={"border-t border-border/50 hover:bg-secondary/40 transition-colors " + (idx % 2 !== 0 ? "bg-muted/10" : "")}>
                  <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(c.created_date)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold">{c.client_name}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{c.client_cc}</td>
                  <td className="px-4 py-2.5 text-xs">{c.template_name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={"px-2 py-0.5 rounded text-[11px] font-semibold " + (STATUS_COLORS[c.status] || STATUS_COLORS.borrador)}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewDoc(c)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewDoc?.client_name} — {previewDoc?.template_name}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none p-6 bg-white border border-border rounded-lg text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: previewDoc?.content || "" }} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => {
              const win = window.open("", "_blank");
              win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Documento</title>
                <style>body{font-family:Georgia,serif;max-width:750px;margin:40px auto;font-size:14px;line-height:1.6;}</style></head>
                <body>${previewDoc?.content}</body></html>`);
              win.document.close(); win.print();
            }}>
              Imprimir / PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
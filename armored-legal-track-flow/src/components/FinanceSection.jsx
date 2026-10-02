import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function FinanceSection({ finances, onEdit, processId }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id) => base44.entities.ProcessFinance.delete(id),
    onSuccess: () => { toast.success("Movimiento eliminado"); qc.invalidateQueries({ queryKey: ["finances", processId] }); qc.invalidateQueries({ queryKey: ["finances"] }); }
  });

  const totalIn = finances.filter(f => f.type === "ingreso").reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = finances.filter(f => f.type === "egreso").reduce((s, f) => s + (f.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Ingresos</p><p className="text-sm font-bold text-emerald-600">{fmt(totalIn)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Egresos</p><p className="text-sm font-bold text-red-600">{fmt(totalOut)}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Balance</p><p className={`text-sm font-bold ${totalIn - totalOut >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(totalIn - totalOut)}</p></CardContent></Card>
      </div>

      {finances.length > 0 ? (
        <div className="space-y-2">
          {finances.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 border rounded-xl bg-card group hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 min-w-0">
                {f.type === "ingreso" ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" /> : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.concept}</p>
                  <p className="text-xs text-muted-foreground">{f.date ? format(parseISO(f.date), "d MMM yyyy", { locale: es }) : "Sin fecha"}{f.payment_method ? ` · ${f.payment_method}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${f.type === "ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                  {f.type === "ingreso" ? "+" : "-"}{fmt(f.amount)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(f)}><Edit className="h-3 w-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle><AlertDialogDescription>Se eliminará este registro financiero.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(f.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-xl bg-card">
          <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sin movimientos financieros registrados</p>
        </div>
      )}
    </div>
  );
}
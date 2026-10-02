import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { CheckCircle, AlertCircle } from "lucide-react";
import { toastReportUpdated, toastError } from "@/utils/toastUtils";

export default function ProcessAdvanceForm({ open, onOpenChange, report, processId, clientId }) {
  const [newStatus, setNewStatus] = useState(report?.status || "");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (status) => {
      if (status === "eliminado_exito") {
        const res = await base44.functions.invoke("processNegativeReportSuccess", {
          report_id: report.id,
          process_id: processId,
          client_id: clientId
        });
        return { status, data: res.data };
      } else if (status === "inviable") {
        await base44.entities.ClientNegativeReport.update(report.id, { status: "inviable", fecha_resolucion: new Date().toISOString() });
        return { status, data: null };
      }
    },
    onSuccess: (result) => {
      toastReportUpdated(result.status, result.data?.invoice);
      qc.invalidateQueries({ queryKey: ["client_negative_reports"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toastError(error.message || "Error al actualizar el reporte");
    }
  });

  const handleSubmit = () => {
    if (!newStatus) return toast.error("Selecciona un estado");
    mutation.mutate(newStatus);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar Estado del Reporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Reporte</Label>
            <p className="text-sm font-medium text-foreground mt-1">{report?.entity_name}</p>
          </div>
          <div>
            <Label htmlFor="status">Nuevo Estado</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_gestion">En Gestión</SelectItem>
                <SelectItem value="eliminado_exito">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Eliminado con Éxito
                  </div>
                </SelectItem>
                <SelectItem value="inviable">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    Inviable
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newStatus === "eliminado_exito" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
              Se generará automáticamente una factura de honorarios de éxito.
            </div>
          )}
          {newStatus === "inviable" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              El reporte se marcará como inviable sin generar cobro.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Actualizando..." : "Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
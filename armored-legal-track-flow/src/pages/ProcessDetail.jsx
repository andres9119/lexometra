import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import {
  ArrowLeft, Edit, Trash2, Plus,
  User, Users, Landmark, Calendar,
  Briefcase, AlertTriangle, MessageSquare, FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import ProcessForm from "@/components/ProcessForm";
import FinanceForm from "@/components/FinanceForm";
import FinanceSection from "@/components/FinanceSection";
import LegalActionAccordion from "@/components/LegalActionAccordion";
import LegalActionForm from "@/components/LegalActionForm";
import PanelActividad from "@/components/PanelActividad";
import PanelDocumentos from "@/components/PanelDocumentos";
import ActuacionesTable from "@/components/ActuacionesTable";

const SL = { activo: "Activo", en_tramite: "En trámite", finalizado: "Finalizado", archivado: "Archivado" };
const SC = {
  activo:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  en_tramite: "bg-amber-100 text-amber-700 border-amber-200",
  finalizado: "bg-slate-100 text-slate-600 border-slate-200",
  archivado:  "bg-red-100 text-red-600 border-red-200",
};
const TL = {
  tutela: "Acción de Tutela",
  derecho_peticion: "Derecho de Petición",
  recurso: "Recurso",
  incidente_desacato: "Incidente de Desacato",
  eliminacion_reportes: "Eliminación de Reportes",
  proteccion_consumidor: "Protección al Consumidor",
  superfinanciera: "Superfinanciera",
  sic: "SIC",
  ejecutivo: "Proceso Ejecutivo",
  otro: "Otro",
};
const PL = { alta: "Alta", media: "Media", baja: "Baja" };
const PC = {
  alta:  "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baja:  "bg-slate-100 text-slate-500 border-slate-200",
};

const fmtDate = (d) => {
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return "—"; }
};

export default function ProcessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showEdit, setShowEdit]           = useState(false);
  const [showFinance, setShowFinance]     = useState(false);
  const [editFinance, setEditFinance]     = useState(null);
  const [showNewAction, setShowNewAction] = useState(false);
  const [editAction, setEditAction]       = useState(null);
  const [mainTab, setMainTab]             = useState("actuaciones");

  const { data: process, isLoading } = useQuery({
    queryKey: ["process", id],
    queryFn: () => base44.entities.Process.get(id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!process?.assigned_lawyer_id && !process?.assigned_lawyer_name,
  });

  const lawyerName = process?.assigned_lawyer_name ||
    users.find(u => u.id === process?.assigned_lawyer_id)?.full_name || "—";

  const { data: legalActions = [] } = useQuery({
    queryKey: ["legal_actions", id],
    queryFn: () => base44.entities.LegalAction.filter({ macro_process_id: id }, "created_date"),
  });

  const { data: finances = [] } = useQuery({
    queryKey: ["finances", id],
    queryFn: () => base44.entities.ProcessFinance.filter({ process_id: id }, "-date"),
  });

  const delMut = useMutation({
    mutationFn: () => base44.entities.Process.delete(id),
    onSuccess: () => {
      toast.success("Expediente eliminado");
      navigate("/processes");
      qc.invalidateQueries({ queryKey: ["processes"] });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full py-24">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!process) return (
    <div className="p-8 text-center text-muted-foreground">Expediente no encontrado</div>
  );

  const activeActions = legalActions.filter(a => a.status === "activo" || a.status === "en_tramite");
  const closedActions = legalActions.filter(a => a.status === "finalizado" || a.status === "archivado");

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ background: "#F7F7F8" }}>
      <div className="max-w-[1400px] mx-auto w-full">

        {/* Top action bar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
          <Link to="/processes">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-xs border-slate-200" onClick={() => setShowEdit(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar expediente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará el expediente, todas sus actuaciones y etapas de forma permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delMut.mutate()} className="bg-destructive text-destructive-foreground">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs border-slate-300">{TL[process.type] || process.type}</Badge>
            <Badge className={`text-xs border ${SC[process.status]}`}>{SL[process.status]}</Badge>
            {process.priority && (
              <Badge className={`text-xs border ${PC[process.priority]}`}>{PL[process.priority]}</Badge>
            )}
          </div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: "#141743" }}>{process.title}</h1>
          {process.case_number && (
            <p className="text-sm text-slate-400 font-mono mt-0.5">Radicado: {process.case_number}</p>
          )}
        </div>

        {/* Metadata card with soft icon boxes */}
        <div className="px-5 pb-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-slate-100">
              {[
                { icon: User, bg: "bg-blue-50", color: "text-blue-600", label: "Accionante", value: process.plaintiff },
                { icon: Users, bg: "bg-violet-50", color: "text-violet-600", label: "Accionado", value: process.defendant },
                { icon: Landmark, bg: "bg-amber-50", color: "text-amber-600", label: "Juzgado / Entidad", value: process.judge_entity },
                { icon: User, bg: "bg-emerald-50", color: "text-emerald-600", label: "Abogado", value: lawyerName },
                { icon: Calendar, bg: "bg-cyan-50", color: "text-cyan-600", label: "Fecha inicio", value: process.start_date ? fmtDate(process.start_date) : null },
                { icon: AlertTriangle, bg: "bg-rose-50", color: "text-rose-600", label: "Próximo vencimiento", value: process.next_deadline ? fmtDate(process.next_deadline) : null },
              ].map((m, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${m.bg}`}>
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
                    <p className="text-sm font-medium truncate text-slate-700">{m.value || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
            {process.description && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Descripción</p>
                <p className="text-sm text-slate-600 leading-relaxed">{process.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pill navigation + split layout */}
        <div className="px-5 pb-3">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setMainTab("actuaciones")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                mainTab === "actuaciones" ? "text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={mainTab === "actuaciones" ? { background: "#141743" } : {}}>
              Actuaciones Jurídicas
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${mainTab === "actuaciones" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {legalActions.length}
              </span>
            </button>
            <button onClick={() => setMainTab("finances")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                mainTab === "finances" ? "text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={mainTab === "finances" ? { background: "#141743" } : {}}>
              Financiero
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${mainTab === "finances" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {finances.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-5 md:items-start px-5 pb-5">

          {/* ── LEFT COLUMN (70%) — Actuaciones + Finanzas ── */}
          <div className="w-full md:flex-[7] min-w-0">
            {mainTab === "actuaciones" && (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {legalActions.length === 0
                      ? "Sin actuaciones registradas"
                      : `${activeActions.length} activa${activeActions.length !== 1 ? "s" : ""} · ${closedActions.length} cerrada${closedActions.length !== 1 ? "s" : ""}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {legalActions.length > 0 && (
                      <ActuacionesTable
                        legalActions={legalActions}
                        macroProcessId={id}
                        plaintiff={process.plaintiff}
                      />
                    )}
                    <Button size="sm" className="gap-1.5" onClick={() => { setEditAction(null); setShowNewAction(true); }}>
                      <Plus className="h-3.5 w-3.5" /> Nueva Actuación
                    </Button>
                  </div>
                </div>

                {legalActions.length === 0 && (
                  <div className="text-center py-16 border border-dashed border-border rounded-xl">
                    <Briefcase className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">No hay actuaciones en este expediente</p>
                    <p className="text-muted-foreground text-xs mt-1">Agrega la primera tutela, petición o recurso</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditAction(null); setShowNewAction(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva Actuación
                    </Button>
                  </div>
                )}

                {activeActions.length > 0 && (
                  <div className="space-y-3">
                    {activeActions.map((action, idx) => (
                      <LegalActionAccordion
                        key={action.id}
                        action={action}
                        defaultOpen={false}
                        onEdit={(a) => { setEditAction(a); setShowNewAction(true); }}
                      />
                    ))}
                  </div>
                )}

                {closedActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Cerradas / Archivadas</p>
                    {closedActions.map((action) => (
                      <LegalActionAccordion
                        key={action.id}
                        action={action}
                        defaultOpen={false}
                        onEdit={(a) => { setEditAction(a); setShowNewAction(true); }}
                      />
                    ))}
                  </div>
                )}
            </div>
            )}

            {mainTab === "finances" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-700">Movimientos financieros</h3>
                  <Button size="sm" className="h-8 text-xs text-white" style={{ background: "#141743" }} onClick={() => { setEditFinance(null); setShowFinance(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                  </Button>
                </div>
                <FinanceSection finances={finances} onEdit={f => { setEditFinance(f); setShowFinance(true); }} processId={id} />
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (30%) — stacked below on mobile ── */}
          <div className="w-full md:flex-[3] min-w-0">
            <Tabs defaultValue="actividad" className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-3">
                <TabsTrigger value="actividad" className="text-xs">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Actividad
                </TabsTrigger>
                <TabsTrigger value="documentos" className="text-xs">
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Documentos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="actividad">
                <PanelActividad processId={id} processTitulo={process?.title || process?.case_number} />
              </TabsContent>
              <TabsContent value="documentos">
                <PanelDocumentos macroProcessId={id} />
              </TabsContent>
            </Tabs>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}
      <ProcessForm
        open={showEdit}
        onOpenChange={setShowEdit}
        process={process}
        onSuccess={() => {
          setShowEdit(false);
          qc.invalidateQueries({ queryKey: ["process", id] });
          qc.invalidateQueries({ queryKey: ["processes"] });
        }}
      />
      <LegalActionForm
        open={showNewAction}
        onOpenChange={(v) => { setShowNewAction(v); if (!v) setEditAction(null); }}
        macroProcessId={id}
        action={editAction}
        processType={process.type}
        onSuccess={() => { setShowNewAction(false); setEditAction(null); }}
      />
      <FinanceForm
        open={showFinance}
        onOpenChange={setShowFinance}
        finance={editFinance}
        processId={id}
        onSuccess={() => { setShowFinance(false); qc.invalidateQueries({ queryKey: ["finances", id] }); }}
      />
    </div>
  );
}
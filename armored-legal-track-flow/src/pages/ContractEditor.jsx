import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Download, Save, CheckCircle2, Search, FileText,
  Eye, Edit3, Printer, ShieldCheck, Clock, FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRef } from "react";

const fmt = (n) => n != null
  ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n) : "";

const SERVICE_LABELS = {
  eliminacion_reportes: "Eliminación de Reportes",
  tutela: "Acción de Tutela", sic: "Proceso SIC", cartera: "Gestión de Cartera", otro: "Otro",
};

function fillTemplate(content, client) {
  if (!client) return content;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  return content
    .replace(/\{\{NOMBRE_CLIENTE\}\}/g, client.full_name || "")
    .replace(/\{\{CEDULA\}\}/g, client.cc || "")
    .replace(/\{\{TELEFONO\}\}/g, client.phone || "")
    .replace(/\{\{EMAIL\}\}/g, client.email || "")
    .replace(/\{\{CIUDAD\}\}/g, client.jurisdiction || "")
    .replace(/\{\{VALOR_PACTADO\}\}/g, fmt(client.agreed_value))
    .replace(/\{\{SALDO_PENDIENTE\}\}/g, fmt(client.pending_balance))
    .replace(/\{\{FECHA_CONTRATO\}\}/g, client.contract_date || "")
    .replace(/\{\{SERVICIO\}\}/g, SERVICE_LABELS[client.service_type] || client.service_type || "")
    .replace(/\{\{REFERIDO_POR\}\}/g, client.referrer_name || "")
    .replace(/\{\{FECHA_HOY\}\}/g, today);
}

const STATUS_STEPS = [
  { key: "borrador", label: "Borrador", icon: Clock, color: "bg-slate-100 text-slate-600 border-slate-300" },
  { key: "revisado", label: "Revisado", icon: FileCheck, color: "bg-amber-100 text-amber-700 border-amber-300" },
  { key: "formalizado", label: "Formalizado", icon: ShieldCheck, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
];



// ContentEditable editor that preserves all HTML including tables
function HtmlEditor({ value, onChange }) {
  const ref = useRef(null);
  const lastValue = useRef(value);

  // Sync external value changes (e.g. template load) into the DOM
  const prevValue = useRef(value);
  if (prevValue.current !== value && ref.current && document.activeElement !== ref.current) {
    prevValue.current = value;
    ref.current.innerHTML = value;
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
      dangerouslySetInnerHTML={{ __html: value }}
      className="outline-none min-h-[560px] p-8 text-sm leading-relaxed"
      style={{ fontFamily: "Georgia, serif" }}
    />
  );
}

export default function ContractEditor() {
  const qc = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedTemplate = urlParams.get("template");

  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || "");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [docContent, setDocContent] = useState("");
  const [docStatus, setDocStatus] = useState("borrador");
  const [docNotes, setDocNotes] = useState("");
  const [viewMode, setViewMode] = useState("edit"); // "edit" | "preview"
  const [savedId, setSavedId] = useState(null);
  const [showClientList, setShowClientList] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: () => base44.entities.ContractTemplate.list("-created_date"),
  });
  const { data: allClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const filteredClients = allClients.filter(c =>
    !clientSearch ||
    c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.cc?.includes(clientSearch)
  ).slice(0, 8);

  useEffect(() => {
    if (selectedTemplate) {
      const base = selectedTemplate.content;
      setDocContent(selectedClient ? fillTemplate(base, selectedClient) : base);
    }
  }, [selectedTemplateId]);

  const applyClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.full_name);
    setShowClientList(false);
    const base = selectedTemplate ? selectedTemplate.content : docContent;
    setDocContent(fillTemplate(base, client));
  };

  const saveMutation = useMutation({
    mutationFn: (d) => savedId
      ? base44.entities.GeneratedContract.update(savedId, d)
      : base44.entities.GeneratedContract.create(d),
    onSuccess: (res) => {
      if (!savedId && res?.id) setSavedId(res.id);
      qc.invalidateQueries({ queryKey: ["generated_contracts"] });
      toast.success(docStatus === "formalizado" ? "✅ Contrato formalizado exitosamente" : "Documento guardado");
    },
  });

  const handleSave = (overrideStatus) => {
    if (!selectedClient || !docContent) { toast.error("Selecciona un cliente y una plantilla"); return; }
    const status = overrideStatus || docStatus;
    saveMutation.mutate({
      template_id: selectedTemplateId || null,
      template_name: selectedTemplate?.name || "Sin plantilla",
      client_id: selectedClient.id,
      client_name: selectedClient.full_name,
      client_cc: selectedClient.cc,
      content: docContent,
      status,
      notes: docNotes,
    });
    if (overrideStatus) setDocStatus(overrideStatus);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedTemplate?.name || "Documento"}</title>
      <style>body{font-family:Georgia,serif;max-width:750px;margin:40px auto;font-size:14px;line-height:1.7;color:#111;}
      h2,h3{margin-top:24px;}p{margin:8px 0;}table{width:100%;border-collapse:collapse;}</style>
      </head><body>${docContent}</body></html>`);
    win.document.close();
    win.print();
  };

  const currentStatusIdx = STATUS_STEPS.findIndex(s => s.key === docStatus);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-sidebar border-b border-sidebar-border shrink-0 flex-wrap gap-y-2">
        <Link to="/contracts">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <FileText className="h-4 w-4 text-sidebar-primary" />
        <span className="text-sidebar-foreground font-semibold text-sm flex-1">
          {selectedClient ? selectedTemplate?.name + " — " + selectedClient.full_name : "Generador de Documentos"}
        </span>

        {/* Status steps */}
        <div className="hidden md:flex items-center gap-1">
          {STATUS_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <button onClick={() => setDocStatus(s.key)}
                className={"flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all " +
                  (docStatus === s.key ? s.color : "bg-sidebar-accent/50 text-sidebar-foreground/50 border-transparent")}>
                <s.icon className="h-3 w-3" />{s.label}
              </button>
              {i < STATUS_STEPS.length - 1 && <span className="text-sidebar-foreground/30 text-xs">›</span>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setViewMode(v => v === "edit" ? "preview" : "edit")}>
            {viewMode === "edit" ? <><Eye className="h-3 w-3 mr-1" />Vista previa</> : <><Edit3 className="h-3 w-3 mr-1" />Editar</>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint} disabled={!docContent}>
            <Printer className="h-3 w-3 mr-1" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
            onClick={() => handleSave("revisado")} disabled={!docContent || saveMutation.isPending}>
            <FileCheck className="h-3 w-3 mr-1" /> Revisar
          </Button>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleSave("formalizado")} disabled={!docContent || saveMutation.isPending}>
            <ShieldCheck className="h-3 w-3 mr-1" /> Formalizar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-4">

          {/* Step 1: Template */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold mr-1">1</span>
              Plantilla
            </label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Seleccionar plantilla..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <Link to="/contracts/templates" className="text-[10px] text-accent underline block mt-1">Crear primera plantilla →</Link>
            )}
          </div>

          {/* Step 2: Client */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold mr-1">2</span>
              Cliente
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 text-xs h-8" placeholder="Buscar por nombre o CC..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
                onFocus={() => setShowClientList(true)} />
            </div>
            {showClientList && clientSearch && (
              <div className="mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto z-10 relative">
                {filteredClients.length === 0
                  ? <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                  : filteredClients.map(c => (
                    <button key={c.id} onClick={() => applyClient(c)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border/50 last:border-0">
                      <p className="text-xs font-semibold">{c.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">CC {c.cc} · {c.phone}</p>
                    </button>
                  ))}
              </div>
            )}
            {selectedClient && !showClientList && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">{selectedClient.full_name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">CC {selectedClient.cc} · {selectedClient.phone}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{SERVICE_LABELS[selectedClient.service_type]}</p>
              </div>
            )}
          </div>

          {/* Step 3: Edit hint */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Edit3 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-bold mr-1">3</span>
                  Revisa y edita
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">Usa el editor para ajustar el documento antes de formalizarlo.</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notas internas</label>
            <textarea className="w-full text-xs border border-input rounded-md px-2.5 py-2 resize-none bg-transparent focus:ring-1 focus:ring-ring outline-none"
              rows={3} value={docNotes} onChange={e => setDocNotes(e.target.value)}
              placeholder="Observaciones (no aparecen en el documento)..." />
          </div>

          {/* Save draft */}
          <Button variant="outline" size="sm" className="w-full h-8 text-xs"
            onClick={() => handleSave()} disabled={!docContent || saveMutation.isPending}>
            <Save className="h-3 w-3 mr-1.5" />
            {saveMutation.isPending ? "Guardando..." : savedId ? "Actualizar borrador" : "Guardar borrador"}
          </Button>

          {savedId && docStatus === "formalizado" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-700 flex gap-2 items-center">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span><strong>Formalizado.</strong> El contrato ha sido guardado en el historial.</span>
            </div>
          )}
        </div>

        {/* Main editor / preview */}
        <div className="flex-1 overflow-auto bg-muted/20 p-6">
          {!docContent ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <FileText className="h-12 w-12 opacity-20" />
              <p className="font-semibold">Selecciona una plantilla y un cliente</p>
              <p className="text-sm text-center max-w-sm">El documento se rellenará automáticamente con los datos del cliente y podrás editarlo antes de formalizarlo.</p>
            </div>
          ) : viewMode === "preview" ? (
            <div className="bg-white shadow-lg rounded-xl p-10 max-w-3xl mx-auto min-h-[600px] border border-border">
              <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: docContent }} />
            </div>
          ) : (
            <div className="bg-white shadow-lg rounded-xl overflow-hidden max-w-3xl mx-auto border border-border">
              <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-2">
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Editor de documento — edita libremente antes de formalizar</span>
              </div>
              <HtmlEditor value={docContent} onChange={setDocContent} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, FileText, Copy, Eye, Upload, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactQuill from "react-quill";

const TYPE_LABELS = {
  contrato_servicios: "Contrato de Servicios",
  acuerdo_pago: "Acuerdo de Pago",
  tutela: "Acción de Tutela",
  sic: "Proceso SIC",
  otro: "Otro",
};

const PLACEHOLDERS = [
  { key: "{{NOMBRE_CLIENTE}}", desc: "Nombre completo del cliente" },
  { key: "{{CEDULA}}", desc: "Cédula del cliente" },
  { key: "{{TELEFONO}}", desc: "Teléfono del cliente" },
  { key: "{{EMAIL}}", desc: "Correo del cliente" },
  { key: "{{CIUDAD}}", desc: "Jurisdicción / Ciudad" },
  { key: "{{VALOR_PACTADO}}", desc: "Valor pactado del servicio" },
  { key: "{{SALDO_PENDIENTE}}", desc: "Saldo pendiente" },
  { key: "{{FECHA_CONTRATO}}", desc: "Fecha de firma del contrato" },
  { key: "{{SERVICIO}}", desc: "Tipo de servicio" },
  { key: "{{REFERIDO_POR}}", desc: "Nombre del referidor" },
  { key: "{{FECHA_HOY}}", desc: "Fecha de generación" },
];

const DEFAULT_TEMPLATES = {
  contrato_servicios: `<h2 style="text-align:center;font-size:18px;font-weight:bold;">CONTRATO DE PRESTACIÓN DE SERVICIOS JURÍDICOS</h2>
<p style="text-align:center;">Ciudad de {{CIUDAD}}, {{FECHA_HOY}}</p>
<p>Entre <strong>LEGALTRACK S.A.S.</strong> y <strong>{{NOMBRE_CLIENTE}}</strong>, C.C. <strong>{{CEDULA}}</strong>, teléfono <strong>{{TELEFONO}}</strong>, domiciliado(a) en {{CIUDAD}}, se celebra el presente contrato:</p>
<h3><strong>PRIMERA — OBJETO</strong></h3>
<p>EL PRESTADOR se compromete a prestar al CLIENTE los servicios de <strong>{{SERVICIO}}</strong>.</p>
<h3><strong>SEGUNDA — VALOR Y FORMA DE PAGO</strong></h3>
<p>Valor total: <strong>{{VALOR_PACTADO}}</strong>. Saldo pendiente: <strong>{{SALDO_PENDIENTE}}</strong>.</p>
<h3><strong>TERCERA — VIGENCIA</strong></h3>
<p>Desde la suscripción hasta la terminación exitosa del servicio.</p>
<br/><br/>
<table style="width:100%;border-collapse:collapse;"><tr>
<td style="width:50%;text-align:center;padding-top:40px;">________________________________<br/><strong>LEGALTRACK S.A.S.</strong></td>
<td style="width:50%;text-align:center;padding-top:40px;">________________________________<br/><strong>{{NOMBRE_CLIENTE}}</strong><br/>C.C. {{CEDULA}}</td>
</tr></table>`,
  acuerdo_pago: `<h2 style="text-align:center;font-size:18px;font-weight:bold;">ACUERDO DE PAGO</h2>
<p style="text-align:center;">{{CIUDAD}}, {{FECHA_HOY}}</p>
<p>Yo, <strong>{{NOMBRE_CLIENTE}}</strong>, C.C. <strong>{{CEDULA}}</strong>, teléfono <strong>{{TELEFONO}}</strong>, acuerdo con <strong>LEGALTRACK S.A.S.</strong>:</p>
<h3><strong>PRIMERA — OBLIGACIÓN</strong></h3>
<p>Reconozco adeudar <strong>{{SALDO_PENDIENTE}}</strong> por el servicio de <strong>{{SERVICIO}}</strong> contratado el <strong>{{FECHA_CONTRATO}}</strong>.</p>
<h3><strong>SEGUNDA — FORMA DE PAGO</strong></h3>
<p>Me comprometo a cancelar conforme al plan de pagos acordado.</p>
<br/><br/>
<table style="width:100%;border-collapse:collapse;"><tr>
<td style="width:50%;text-align:center;padding-top:40px;">________________________________<br/><strong>LEGALTRACK S.A.S.</strong></td>
<td style="width:50%;text-align:center;padding-top:40px;">________________________________<br/><strong>{{NOMBRE_CLIENTE}}</strong><br/>C.C. {{CEDULA}}</td>
</tr></table>`,
};

const EMPTY_FORM = { name: "", type: "contrato_servicios", content: "", description: "", is_active: true };

export default function ContractTemplates() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewContent, setPreviewContent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editorMode, setEditorMode] = useState("rich"); // "rich" | "html"

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: () => base44.entities.ContractTemplate.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => editing
      ? base44.entities.ContractTemplate.update(editing.id, d)
      : base44.entities.ContractTemplate.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_templates"] });
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
      toast.success(editing ? "Plantilla actualizada" : "Plantilla creada");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract_templates"] }); toast.success("Plantilla eliminada"); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setEditorMode("rich"); setShowForm(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, content: t.content, description: t.description || "", is_active: t.is_active !== false });
    setEditorMode("rich");
    setShowForm(true);
  };

  // Upload Word file and extract content via AI
  const handleWordUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(docx?|doc)$/i)) { toast.error("Solo se permiten archivos .doc o .docx"); return; }
    setUploading(true);
    toast.info("Procesando documento Word con IA...");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Convierte este documento Word a HTML preservando EXACTAMENTE su formato original.
Reglas estrictas:
- Conserva TODAS las tablas con sus celdas, bordes y estructura exacta (usa etiquetas <table>, <tr>, <td>, <th> con sus atributos de estilo).
- Conserva títulos, subtítulos, negritas, cursivas, subrayados, listas y alineaciones.
- Conserva los estilos de fuente, tamaño y colores usando atributos style inline.
- NO simplifiques ni elimines ningún contenido, tabla, fila o celda.
- Luego, identifica ÚNICAMENTE los campos que claramente representan datos variables del cliente (nombre completo, número de cédula, teléfono, correo, ciudad, valor monetario del contrato, saldo, fecha de firma, tipo de servicio, referido) y reemplázalos por estos marcadores exactos: {{NOMBRE_CLIENTE}}, {{CEDULA}}, {{TELEFONO}}, {{EMAIL}}, {{CIUDAD}}, {{VALOR_PACTADO}}, {{SALDO_PENDIENTE}}, {{FECHA_CONTRATO}}, {{SERVICIO}}, {{REFERIDO_POR}}, {{FECHA_HOY}}.
- Si hay espacios en blanco o líneas de firma (guiones, puntos suspensivos para firmar), consérvalos tal cual.
- Responde ÚNICAMENTE con el HTML resultante completo. Sin explicaciones, sin bloques Markdown, sin etiquetas \`\`\`html.`,
        file_urls: [file_url],
        model: "claude_sonnet_4_6",
      });
      setForm(f => ({ ...f, content: result, name: f.name || file.name.replace(/\.(docx?|doc)$/i, "") }));
      toast.success("Documento importado y convertido correctamente");
    } catch (err) {
      toast.error("Error al procesar el archivo: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const insertPlaceholder = (key) => setForm(f => ({ ...f, content: f.content + key }));

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["clean"],
    ],
  };

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Plantillas de Documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crea plantillas o importa tus documentos Word existentes</p>
        </div>
        <div className="flex gap-2">
          <Link to="/contracts/new">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Generar Documento
            </Button>
          </Link>
          <Button size="sm" className="h-8 text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva Plantilla
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1">Sin plantillas creadas</p>
          <p className="text-xs mb-4">Crea una desde cero o importa tu documento Word</p>
          <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1.5" /> Crear plantilla</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{t.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-semibold">{TYPE_LABELS[t.type] || t.type}</span>
                </div>
                {t.is_active !== false
                  ? <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold shrink-0">Activa</span>
                  : <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold shrink-0">Inactiva</span>}
              </div>
              {t.description && <p className="px-4 py-2 text-xs text-muted-foreground">{t.description}</p>}
              <div className="px-4 py-3 flex items-center justify-between">
                <Link to={"/contracts/new?template=" + t.id}>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <FileText className="h-3 w-3 mr-1" /> Usar
                  </Button>
                </Link>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewContent(t.content)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
          </DialogHeader>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nombre</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Contrato Estándar" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Descripción (opcional)</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción" />
              </div>

              {/* Import Word */}
              <div className="border-2 border-dashed border-border rounded-xl p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">Importar desde Word (.docx / .doc)</p>
                    <p className="text-[10px] text-muted-foreground">La IA extraerá el texto y detectará automáticamente los campos del cliente</p>
                  </div>
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                </div>
                <label className={"flex items-center gap-2 cursor-pointer w-fit " + (uploading ? "opacity-50 pointer-events-none" : "")}>
                  <input type="file" accept=".doc,.docx" className="hidden" onChange={handleWordUpload} />
                  <Button size="sm" variant="outline" className="h-7 text-xs pointer-events-none">
                    <FileUp className="h-3 w-3 mr-1.5" />
                    {uploading ? "Procesando con IA..." : "Seleccionar archivo Word"}
                  </Button>
                </label>
              </div>

              {/* Content editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contenido</label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={editorMode === "rich" ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => setEditorMode("rich")}>Editor</Button>
                    <Button size="sm" variant={editorMode === "html" ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => setEditorMode("html")}>HTML</Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setForm(f => ({ ...f, content: DEFAULT_TEMPLATES[f.type] || "" }))}>
                      <Copy className="h-2.5 w-2.5 mr-1" /> Default
                    </Button>
                  </div>
                </div>
                {editorMode === "rich" ? (
                  <div className="border border-input rounded-md overflow-hidden">
                    <ReactQuill
                      value={form.content}
                      onChange={(val) => setForm(f => ({ ...f, content: val }))}
                      modules={quillModules}
                      style={{ minHeight: "280px" }}
                    />
                  </div>
                ) : (
                  <Textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={16}
                    className="font-mono text-xs"
                    placeholder="HTML con marcadores como {{NOMBRE_CLIENTE}}..."
                  />
                )}
              </div>
            </div>

            {/* Placeholders sidebar */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Marcadores disponibles</p>
              <p className="text-[10px] text-muted-foreground mb-3">Haz clic para insertar en el contenido (solo en modo HTML):</p>
              <div className="space-y-1.5">
                {PLACEHOLDERS.map(p => (
                  <button key={p.key} onClick={() => insertPlaceholder(p.key)}
                    className="w-full text-left px-2.5 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted transition-colors">
                    <code className="text-[11px] font-mono text-accent font-bold block">{p.key}</code>
                    <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button disabled={!form.name || !form.content || saveMutation.isPending || uploading} onClick={() => saveMutation.mutate(form)}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Crear Plantilla"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vista Previa</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none p-6 bg-white border border-border rounded-lg text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: previewContent || "" }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
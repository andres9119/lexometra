import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toTitleCase } from "@/utils/titleCase";
import { formatNIT, getNITDigits } from "@/utils/nitFormat";
import { Building2, ChevronDown, X, AlertTriangle, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Combobox de búsqueda bidireccional (NIT + DV + Razón Social)
 * Solo permite seleccionar entidades existentes en el directorio.
 * Si no existe, ofrece crearla con nombre, NIT y DV obligatorios + confirmación.
 */
export default function EntityCombobox({ entityName, entityNit, entityDv, onSelect }) {
  const [query, setQuery] = useState(entityName || "");
  const [nitValue, setNitValue] = useState(entityNit || "");
  const [dvValue, setDvValue] = useState(entityDv || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [nitOpen, setNitOpen] = useState(false);
  const [allEntities, setAllEntities] = useState([]);
  const [loadedEntities, setLoadedEntities] = useState(false);
  const [selectedFromDir, setSelectedFromDir] = useState(!!entityName);
  const [notFoundAlert, setNotFoundAlert] = useState(false);

  // Flujo de creación
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", nit: "", dv: "" });
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const containerRef = useRef(null);

  const loadEntities = () => {
    base44.entities.DirectorioEntidad.list("-created_date", 500)
      .then(data => { setAllEntities(data); setLoadedEntities(true); })
      .catch(() => setLoadedEntities(true));
  };

  useEffect(() => { loadEntities(); }, []);

  useEffect(() => {
    setQuery(entityName || "");
    setSelectedFromDir(!!entityName);
    setNotFoundAlert(false);
    setShowCreateForm(false);
    setShowConfirm(false);
  }, [entityName]);
  useEffect(() => { setNitValue(entityNit || ""); }, [entityNit]);
  useEffect(() => { setDvValue(entityDv || ""); }, [entityDv]);

  // Filtrar sugerencias
  useEffect(() => {
    const sorted = [...allEntities].sort((a, b) =>
      (a.razon_social || "").localeCompare(b.razon_social || "", "es")
    );
    if (!query.trim() || query.length < 2) {
      setSuggestions(sorted.slice(0, 10));
      return;
    }
    const q = query.toLowerCase();
    const filtered = sorted.filter(e =>
      e.razon_social?.toLowerCase().includes(q) ||
      e.nit?.toLowerCase().includes(q)
    );
    const seen = new Set();
    const deduplicated = filtered.filter(e => {
      const normalized = e.razon_social?.toLowerCase().replace(/[.\s-]/g, "") || "";
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).slice(0, 10);
    setSuggestions(deduplicated);
  }, [query, allEntities]);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        if (query.trim() && !selectedFromDir && !showCreateForm && !showConfirm) {
          setNotFoundAlert(true);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, selectedFromDir, showCreateForm, showConfirm]);

  const handleQueryChange = (e) => {
    const tc = toTitleCase(e.target.value);
    setQuery(tc);
    setSelectedFromDir(false);
    setNotFoundAlert(false);
    setShowCreateForm(false);
    setShowConfirm(false);
    setOpen(true);
    onSelect({ razon_social: "", nit: "", dv: "" });
  };

  const [nitSuggestions, setNitSuggestions] = useState([]);

  const handleNitChange = (e) => {
    const formatted = formatNIT(e.target.value);
    setNitValue(formatted);
    const digits = getNITDigits(formatted);
    if (digits.length >= 2) {
      const filtered = allEntities
        .filter(en => en.nit?.toLowerCase().includes(digits.toLowerCase()))
        .sort((a, b) => (a.razon_social || "").localeCompare(b.razon_social || "", "es"))
        .slice(0, 10);
      setNitSuggestions(filtered);
      setNitOpen(true);
    } else {
      setNitSuggestions([]);
      setNitOpen(false);
    }
  };

  const handleDvChange = (e) => {
    const val = e.target.value.slice(0, 1);
    if (/^\d?$/.test(val)) setDvValue(val);
  };

  const selectSuggestion = (entity) => {
    const tc = toTitleCase((entity.razon_social || "").replace(/\./g, ""));
    const [nitPart, dvPart] = (entity.nit || "").split("-");
    setQuery(tc);
    setNitValue(formatNIT(nitPart || ""));
    setDvValue(dvPart || "");
    setSuggestions([]);
    setOpen(false);
    setSelectedFromDir(true);
    setNotFoundAlert(false);
    setShowCreateForm(false);
    setShowConfirm(false);
    onSelect({ razon_social: tc.replace(/\./g, ""), nit: getNITDigits(nitPart || ""), dv: dvPart || "" });
  };

  const clearEntity = () => {
    setQuery(""); setNitValue(""); setDvValue("");
    setSuggestions([]);
    setSelectedFromDir(false);
    setNotFoundAlert(false);
    setShowCreateForm(false);
    setShowConfirm(false);
    setCreateErrors({});
    onSelect({ razon_social: "", nit: "", dv: "" });
  };

  // Abrir formulario de creación con datos prellenados
  const openCreateForm = () => {
    setCreateForm({
      name: query || "",
      nit: getNITDigits(nitValue) || "",
      dv: dvValue || "",
    });
    setCreateErrors({});
    setShowCreateForm(true);
    setNotFoundAlert(false);
    setShowConfirm(false);
  };

  const validateCreateForm = () => {
    const errors = {};
    if (!createForm.name.trim()) errors.name = "La razón social es obligatoria";
    if (!createForm.nit.trim()) errors.nit = "El NIT es obligatorio";
    if (!createForm.dv.trim()) errors.dv = "El DV es obligatorio";
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmRequest = () => {
    if (!validateCreateForm()) return;
    setShowConfirm(true);
  };

  const handleCreateConfirmed = async () => {
    setCreating(true);
    const cleanName = toTitleCase(createForm.name.trim());
    const nitFull = `${createForm.nit.trim()}-${createForm.dv.trim()}`;
    await base44.entities.DirectorioEntidad.create({ razon_social: cleanName, nit: nitFull });
    await loadEntities();
    setQuery(cleanName);
    setNitValue(formatNIT(createForm.nit));
    setDvValue(createForm.dv);
    setSelectedFromDir(true);
    setShowCreateForm(false);
    setShowConfirm(false);
    setCreating(false);
    onSelect({ razon_social: cleanName, nit: createForm.nit.trim(), dv: createForm.dv.trim() });
  };

  return (
    <div ref={containerRef} className="col-span-2 space-y-2">
      {/* Razón Social */}
      <div className="relative">
        <Label className="text-xs font-medium text-slate-600">
          Entidad / Razón Social *
          {loadedEntities && allEntities.length > 0 && (
            <span className="ml-2 text-[10px] font-normal text-slate-400">
              ({allEntities.length} en directorio)
            </span>
          )}
        </Label>
        <div className="relative mt-0.5">
          <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={handleQueryChange}
            placeholder="Buscar entidad en directorio..."
            className={`pl-8 pr-8 uppercase ${selectedFromDir ? "border-emerald-400 bg-emerald-50/30" : ""}`}
            autoComplete="off"
          />
          {query ? (
            <button type="button" onClick={clearEntity}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="button" onClick={() => setOpen(o => !o)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Dropdown sugerencias */}
        {open && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(entity => (
              <button key={entity.id} type="button" onMouseDown={() => selectSuggestion(entity)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                <p className="text-sm font-semibold text-slate-800 uppercase">{entity.razon_social}</p>
                {entity.nit && <p className="text-[11px] font-mono text-slate-400">NIT: {entity.nit}</p>}
              </button>
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {open && query.length >= 2 && suggestions.length === 0 && loadedEntities && !selectedFromDir && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs text-slate-400">
            No se encontró en el directorio
          </div>
        )}
      </div>

      {/* Alerta: no encontrada */}
      {notFoundAlert && !selectedFromDir && !showCreateForm && query.trim() && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Entidad no registrada en el directorio</p>
              <p className="text-xs text-amber-700 mt-0.5">
                <span className="font-bold">"{query}"</span> no existe. ¿Desea crearla?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm"
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
              onClick={openCreateForm}>
              <Plus className="h-3 w-3" /> Sí, crear entidad
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={clearEntity}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Formulario de creación */}
      {showCreateForm && !showConfirm && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-3">
          <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva entidad — complete todos los campos
          </p>

          <div className="space-y-2">
            <div>
              <Label className="text-xs font-medium text-slate-700">Razón Social *</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: toTitleCase(e.target.value) }))}
                placeholder="Nombre de la entidad"
                className={`mt-0.5 text-sm uppercase ${createErrors.name ? "border-red-400" : ""}`}
              />
              {createErrors.name && <p className="text-[10px] text-red-500 mt-0.5">{createErrors.name}</p>}
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-10">
                <Label className="text-xs font-medium text-slate-700">NIT *</Label>
                <Input
                  value={formatNIT(createForm.nit)}
                  onChange={e => setCreateForm(p => ({ ...p, nit: getNITDigits(formatNIT(e.target.value)) }))}
                  placeholder="Ej: 900.123.456"
                  className={`mt-0.5 font-mono text-sm ${createErrors.nit ? "border-red-400" : ""}`}
                />
                {createErrors.nit && <p className="text-[10px] text-red-500 mt-0.5">{createErrors.nit}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-medium text-slate-700">DV *</Label>
                <Input
                  value={createForm.dv}
                  onChange={e => {
                    const val = e.target.value.slice(0, 1);
                    if (/^\d?$/.test(val)) setCreateForm(p => ({ ...p, dv: val }));
                  }}
                  placeholder="0"
                  maxLength="1"
                  className={`mt-0.5 font-mono text-center text-sm ${createErrors.dv ? "border-red-400" : ""}`}
                />
                {createErrors.dv && <p className="text-[10px] text-red-500 mt-0.5">{createErrors.dv}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm"
              className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white gap-1"
              onClick={handleConfirmRequest}>
              <CheckCircle2 className="h-3 w-3" /> Continuar
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => { setShowCreateForm(false); setNotFoundAlert(true); }}>
              Atrás
            </Button>
          </div>
        </div>
      )}

      {/* Confirmación final */}
      {showConfirm && (
        <div className="border-2 border-emerald-400 bg-emerald-50 rounded-lg p-3 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-800">¿Confirma que los datos son correctos?</p>
              <p className="text-[11px] text-emerald-700 mt-1">Esta entidad será creada en el directorio:</p>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-md px-3 py-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Razón Social</span>
              <span className="font-bold text-slate-800 uppercase">{createForm.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">NIT</span>
              <span className="font-mono font-semibold text-slate-800">{formatNIT(createForm.nit)}-{createForm.dv}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              disabled={creating}
              onClick={handleCreateConfirmed}>
              {creating
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</>
                : <><CheckCircle2 className="h-3 w-3" /> Sí, crear entidad</>}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
              disabled={creating}
              onClick={() => setShowConfirm(false)}>
              Corregir datos
            </Button>
          </div>
        </div>
      )}

      {/* Indicador de selección válida */}
      {selectedFromDir && query && !showCreateForm && !showConfirm && (
        <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Entidad registrada en directorio
        </p>
      )}

      {/* NIT + DV (solo cuando no está en flujo de creación) */}
      {!showCreateForm && !showConfirm && (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-10 relative">
            <Label className="text-xs font-medium text-slate-600">NIT <span className="text-slate-400 font-normal">(opcional)</span></Label>
            <Input
              value={nitValue}
              onChange={handleNitChange}
              onFocus={() => { if (getNITDigits(nitValue).length >= 2) setNitOpen(true); }}
              onBlur={() => setTimeout(() => setNitOpen(false), 150)}
              placeholder="Ej: 900.123.456"
              className="mt-0.5 font-mono"
              autoComplete="off"
            />
            {nitOpen && nitSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {nitSuggestions.map(entity => (
                  <button key={entity.id} type="button"
                    onMouseDown={() => { selectSuggestion(entity); setNitOpen(false); setNitSuggestions([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                    <p className="text-sm font-semibold text-slate-800 uppercase">{entity.razon_social}</p>
                    {entity.nit && <p className="text-[11px] font-mono text-slate-400">NIT: {entity.nit}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-slate-600">DV</Label>
            <Input
              value={dvValue}
              onChange={handleDvChange}
              placeholder="0"
              maxLength="1"
              className="mt-0.5 font-mono text-center text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
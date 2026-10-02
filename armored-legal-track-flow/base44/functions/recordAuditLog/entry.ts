import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Human-readable labels for known fields
const FIELD_LABELS = {
  full_name: "Nombre completo",
  cc: "Cédula",
  phone: "Celular",
  email: "Correo electrónico",
  address: "Dirección",
  neighborhood: "Barrio",
  city: "Ciudad",
  department: "Departamento",
  vereda: "Vereda",
  jurisdiction: "Jurisdicción",
  status: "Estado",
  service_type: "Tipo de servicio",
  agreed_value: "Valor pactado",
  pending_balance: "Saldo pendiente",
  datacredito_key: "Clave DataCrédito",
  transunion_key: "Clave TransUnion",
  score_data: "Score DataCrédito",
  score_transunion: "Score TransUnion",
  notes: "Observaciones",
  next_action_date: "Fecha próxima acción",
  contract_date: "Fecha contrato",
  victim_conflict: "Víctima del conflicto",
  indigenous: "Indígena",
  elderly: "Adulto mayor",
  psychological_impact: "Afectación psicológica",
  single_mother: "Madre cabeza de familia",
  referrer_name: "Nombre referido",
  // CreditAgreement
  description: "Descripción",
  total_amount: "Capital total",
  interest_rate: "Tasa de interés",
  num_installments: "N° cuotas",
  installment_amount: "Valor cuota",
  total_with_interest: "Total con interés",
  start_date: "Fecha inicio",
  // GeneratedContract / Invoice
  concept: "Concepto",
  amount: "Monto",
  amount_paid: "Monto pagado",
  due_date: "Fecha vencimiento",
  template_name: "Plantilla",
  client_name: "Nombre cliente",
};

const SKIP_FIELDS = new Set([
  "id", "created_date", "updated_date", "created_by_id",
  "content", "client_id", "process_id", "agreement_id",
  "referrer_id", "template_id", "client_cc", "client_phone",
]);

const ENTITY_LABELS = {
  Client: "Perfil del cliente",
  CreditAgreement: "Acuerdo/Crédito",
  GeneratedContract: "Contrato",
  Invoice: "Factura",
};

function stringify(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (typeof val === "number") return val.toLocaleString("es-CO");
  return String(val);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;
    const entityType = event?.entity_name;
    const entityId = event?.entity_id;
    const action = event?.type; // create | update | delete

    if (!data && action !== "delete") {
      return Response.json({ ok: true, skipped: "no data" });
    }

    // Resolve client_id
    let clientId = null;
    if (entityType === "Client") {
      clientId = entityId;
    } else if (data?.client_id) {
      clientId = data.client_id;
    } else if (old_data?.client_id) {
      clientId = old_data.client_id;
    }

    if (!clientId) {
      return Response.json({ ok: true, skipped: "no client_id" });
    }

    // Resolve user who made the change
    let userName = "Sistema";
    let userId = data?.created_by_id || old_data?.created_by_id || null;
    if (userId) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: userId });
        if (users?.length > 0) {
          userName = users[0].full_name || users[0].email || userId;
        }
      } catch (_) {
        // ignore
      }
    }

    const entityLabel = ENTITY_LABELS[entityType] || entityType;
    const logs = [];

    if (action === "create") {
      // Log the creation as a single summary entry
      const nameField = data?.full_name || data?.description || data?.client_name || data?.concept || data?.invoice_number || "";
      logs.push({
        client_id: clientId,
        entity_type: entityType,
        entity_id: entityId,
        action: "create",
        field_name: "_create",
        field_label: "Creación",
        old_value: null,
        new_value: nameField || entityLabel,
        user_name: userName,
        user_id: userId,
        summary: `Nuevo registro creado en ${entityLabel}${nameField ? ": " + nameField : ""}`,
      });
    } else if (action === "update" && old_data) {
      // Diff each changed field
      const allKeys = new Set([...Object.keys(data || {}), ...Object.keys(old_data || {})]);
      for (const key of allKeys) {
        if (SKIP_FIELDS.has(key)) continue;
        const oldVal = old_data[key];
        const newVal = data[key];
        if (stringify(oldVal) === stringify(newVal)) continue;
        const label = FIELD_LABELS[key] || key;
        logs.push({
          client_id: clientId,
          entity_type: entityType,
          entity_id: entityId,
          action: "update",
          field_name: key,
          field_label: label,
          old_value: stringify(oldVal),
          new_value: stringify(newVal),
          user_name: userName,
          user_id: userId,
          summary: `${entityLabel} › ${label}: ${stringify(oldVal)} ——→ ${stringify(newVal)}`,
        });
      }
    }

    // Bulk create log entries
    for (const entry of logs) {
      await base44.asServiceRole.entities.ClientAuditLog.create(entry);
    }

    return Response.json({ ok: true, logged: logs.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
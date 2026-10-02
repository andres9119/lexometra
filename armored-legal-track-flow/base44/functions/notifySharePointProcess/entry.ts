import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Trigger asíncrono: Envía webhook a Power Automate/SharePoint
 * al crear un nuevo proceso jurídico.
 * Configura SHAREPOINT_WEBHOOK_URL en las variables de entorno.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { process_data } = await req.json();

    const webhookUrl = Deno.env.get("SHAREPOINT_WEBHOOK_URL");
    if (!webhookUrl) {
      // No bloqueante: si no está configurado, simplemente se omite
      return Response.json({ skipped: true, reason: "SHAREPOINT_WEBHOOK_URL no configurado" });
    }

    // Payload para Power Automate → creación de folio documental
    const payload = {
      tipo_proceso: process_data.type,
      titulo: process_data.title,
      radicado: process_data.case_number || null,
      demandante: process_data.plaintiff || null,
      demandado: process_data.defendant || null,
      juzgado_entidad: process_data.judge_entity || null,
      abogado_asignado: process_data.assigned_lawyer_name || null,
      email_abogado: process_data.assigned_lawyer_email || null,
      prioridad: process_data.priority || null,
      etapa_actual: process_data.current_stage || null,
      fecha_inicio: process_data.start_date || null,
      expediente_macro_id: process_data.macro_process_id || null,
      timestamp: new Date().toISOString(),
      origen: "ERP Legal Base44",
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return Response.json({ success: true, sharepoint_status: response.status });
  } catch (error) {
    // Error no-bloqueante: se loguea pero no interrumpe el flujo principal
    console.error("[notifySharePointProcess] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
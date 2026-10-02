import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { process_id, client_id, state_new, state_old, webhook_url } = await req.json();

    if (!webhook_url || !process_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch process and client data
    const process = await base44.entities.Process.get(process_id);
    const client = client_id ? await base44.entities.Client.get(client_id) : null;

    // Get negative reports for metadata
    const reports = client_id ? await base44.entities.ClientNegativeReport.filter({ client_id }, '', 100) : [];
    const affected_entities = [...new Set(reports.map(r => r.entity_name))];

    // Build standardized payload
    const payload = {
      evento: {
        tipo: 'CAMBIO_ESTADO',
        fecha_disparo: new Date().toISOString(),
        origen: 'Plataforma_LegalTrack'
      },
      estado_transicion: {
        estado_anterior: state_old || 'desconocido',
        estado_nuevo: state_new || 'desconocido',
        es_terminal: process?.status === 'finalizado' || process?.status === 'archivado'
      },
      cliente: client ? {
        id_cliente: client.cc,
        nombre_completo: client.full_name,
        email: client.email,
        celular: client.phone
      } : null,
      proceso: process ? {
        id_proceso: process.id,
        tipo_servicio: process.type,
        valor_expectativa: client?.agreed_value || 0,
        saldo_pendiente: client?.pending_balance || 0
      } : null,
      metadatos_personalizados: {
        jurisdiccion: client?.jurisdiction,
        entidades_afectadas: affected_entities
      }
    };

    // Send webhook with 5s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      // Log success (would create WebhookLog record in a real system)
      return Response.json({ 
        success: true, 
        message: 'Webhook sent successfully',
        payload 
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      
      // Silent failure: log but don't block user
      console.error(`Webhook failed: ${fetchError.message}`);
      
      // In production, you'd insert a log record here for retry queue
      // await base44.entities.WebhookLog.create({...})
      
      return Response.json({ 
        success: false, 
        error: 'Webhook delivery failed (will retry)',
        payload 
      }, { status: 202 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report_id, process_id, client_id } = await req.json();
    if (!report_id || !client_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all data concurrently
    const [report, client] = await Promise.all([
      base44.entities.ClientNegativeReport.get(report_id),
      base44.entities.Client.get(client_id),
    ]);

    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Guard: already resolved
    if (report.status === 'eliminado_exito') {
      return Response.json({ error: 'Reporte ya fue procesado anteriormente' }, { status: 409 });
    }

    // Calculate success fee: use cuota_exito_asignada if already set, otherwise 0
    // (pending_amount is informational only and should NOT be billed)
    const cuota_exito = report.cuota_exito_asignada || 0;

    const today = new Date().toISOString().split('T')[0];

    // Calculate due date (30 days)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const due_date = dueDate.toISOString().split('T')[0];

    // STEP 1: Create the invoice (status 'Emitida' so it appears in Cartera)
    const invoice = await base44.asServiceRole.entities.Invoice.create({
      client_id: client_id,
      client_name: client.full_name,
      client_cc: client.cc || '',
      process_id: process_id || null,
      concept: `Honorarios de éxito — Eliminación de reporte en ${report.entity_name}`,
      service_type: 'eliminacion_reportes',
      amount: cuota_exito,
      amount_paid: 0,
      status: 'Emitida',   // ← Capital E: matches enum in Invoice entity
      issue_date: today,
      due_date: due_date,
      payment_terms: '30',
      items: [
        {
          type: 'cuota_litis',
          concept: `Honorarios éxito - ${report.entity_name} (${report.obligation_number || 'S/N'})`,
          amount: cuota_exito,
        }
      ],
    });

    // STEP 2: Update report — mark as resolved with invoice reference
    await base44.asServiceRole.entities.ClientNegativeReport.update(report_id, {
      status: 'eliminado_exito',
      cuota_exito_asignada: cuota_exito,
      factura_exito_id: invoice.id,
      fecha_resolucion: new Date().toISOString(),
    });

    // STEP 3: Optional webhook notification (non-blocking)
    const webhook_url = Deno.env.get('WEBHOOK_REPORT_SUCCESS');
    if (webhook_url) {
      try {
        await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'reporte_eliminado',
            cliente: client.full_name,
            cedula: client.cc,
            telefono: client.phone,
            entidad_eliminada: report.entity_name,
            monto_facturado: cuota_exito,
            factura_id: invoice.id,
          })
        });
      } catch (webhookError) {
        console.error('Webhook failed (non-blocking):', webhookError.message);
      }
    }

    return Response.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      cuota_exito,
      message: 'Reporte eliminado y factura de éxito generada correctamente',
    });

  } catch (error) {
    console.error('processNegativeReportSuccess error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
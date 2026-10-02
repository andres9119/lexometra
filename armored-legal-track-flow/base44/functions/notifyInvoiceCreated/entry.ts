import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id, client_id } = await req.json();
    if (!invoice_id || !client_id) {
      return Response.json({ error: 'Missing invoice_id or client_id' }, { status: 400 });
    }

    // Fetch invoice and client
    const invoice = await base44.entities.Invoice.get(invoice_id);
    const client = await base44.entities.Client.get(client_id);

    if (!invoice || !client) {
      return Response.json({ error: 'Invoice or Client not found' }, { status: 404 });
    }

    // Send webhook notification for new invoice
    const webhook_url = Deno.env.get('WEBHOOK_INVOICE_CREATED');
    if (webhook_url) {
      try {
        const due_date = invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'factura_generada',
            cliente: client.full_name,
            telefono: client.phone,
            monto: invoice.amount,
            concepto: invoice.concept,
            numero_factura: invoice.invoice_number,
            fecha_vencimiento: due_date,
            link_pago: `${Deno.env.get('APP_BASE_URL') || 'https://app.example.com'}/payment/${invoice_id}`
          })
        });
      } catch (webhookError) {
        console.error('Webhook failed (non-blocking):', webhookError.message);
      }
    }

    return Response.json({
      success: true,
      message: 'Notificación de factura enviada'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
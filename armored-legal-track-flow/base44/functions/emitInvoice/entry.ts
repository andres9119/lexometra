import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id, billing_resolution_id } = await req.json();

    if (!invoice_id || !billing_resolution_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the billing resolution to get the next consecutive number
    const resolution = await base44.asServiceRole.entities.BillingResolution.get(billing_resolution_id);
    if (!resolution) {
      return Response.json({ error: 'Billing resolution not found' }, { status: 404 });
    }

    // Calculate next consecutive
    const nextConsecutive = (resolution.current_consecutive || 0) + 1;
    if (nextConsecutive > resolution.final_consecutive) {
      return Response.json({ error: 'Billing resolution limit reached' }, { status: 400 });
    }

    // Generate invoice number
    const invoiceNumber = `${resolution.prefix}-${String(nextConsecutive).padStart(6, '0')}`;

    // Update invoice with number and status
    const updatedInvoice = await base44.asServiceRole.entities.Invoice.update(invoice_id, {
      invoice_number: invoiceNumber,
      status: 'Emitida',
    });

    // Update billing resolution consecutive
    await base44.asServiceRole.entities.BillingResolution.update(billing_resolution_id, {
      current_consecutive: nextConsecutive,
    });

    return Response.json({ success: true, invoice: updatedInvoice, invoice_number: invoiceNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
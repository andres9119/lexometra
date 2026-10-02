import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cron job: runs daily to auto-update invoice statuses
// - pendiente/parcial with past due_date → vencida
// - amount_paid >= amount → pagada
// - 0 < amount_paid < amount → parcial

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = await base44.asServiceRole.entities.Invoice.list();

    let updated = 0;
    let overdueNotified = 0;

    for (const inv of invoices) {
      if (inv.status === 'anulada' || inv.status === 'pagada') continue;

      const paid = parseFloat(inv.amount_paid) || 0;
      const total = parseFloat(inv.amount) || 0;

      let newStatus = inv.status;

      // Fully paid
      if (paid >= total && total > 0) {
        newStatus = 'pagada';
      }
      // Partially paid
      else if (paid > 0 && paid < total) {
        // Check if overdue
        if (inv.due_date) {
          const due = new Date(inv.due_date);
          due.setHours(0, 0, 0, 0);
          if (due < today) {
            newStatus = 'vencida';
          } else {
            newStatus = 'parcial';
          }
        } else {
          newStatus = 'parcial';
        }
      }
      // Unpaid - check overdue
      else if (paid === 0) {
        if (inv.due_date) {
          const due = new Date(inv.due_date);
          due.setHours(0, 0, 0, 0);
          if (due < today && inv.status !== 'vencida') {
            newStatus = 'vencida';
          }
        }
      }

      if (newStatus !== inv.status) {
        await base44.asServiceRole.entities.Invoice.update(inv.id, { status: newStatus });
        updated++;

        // Log for newly overdue invoices
        if (newStatus === 'vencida' && inv.client_id) {
          overdueNotified++;
          await base44.asServiceRole.entities.ClientAuditLog.create({
            client_id: inv.client_id,
            entity_type: 'Invoice',
            entity_id: inv.id,
            action: 'update',
            field_name: 'status',
            field_label: 'Estado',
            old_value: inv.status,
            new_value: 'vencida',
            user_name: 'Sistema (Cron)',
            summary: `Factura ${inv.invoice_number || inv.id.slice(-5)} marcada como VENCIDA automáticamente`,
          });
        }
      }
    }

    return Response.json({
      ok: true,
      total: invoices.length,
      updated,
      overdueNotified,
      ran_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Triggered by entity automation when an Invoice is updated to status "Pagada".
 * Calculates referrer commission and records a TreasuryTransaction as saldo a favor.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    // Only process "update" events where status changed to "Pagada"
    if (event?.type !== 'update') return Response.json({ skipped: true });

    const invoice = data;
    if (!invoice || invoice.status !== 'Pagada') return Response.json({ skipped: 'not Pagada' });
    if (!invoice.client_id) return Response.json({ skipped: 'no client_id' });

    // Fetch client to check for referrer
    const client = await base44.asServiceRole.entities.Client.get(invoice.client_id);
    if (!client || !client.referrer_id) return Response.json({ skipped: 'no referrer' });

    // Fetch referrer to get commission %
    const referrer = await base44.asServiceRole.entities.Referrer.get(client.referrer_id);
    if (!referrer || referrer.status !== 'activo') return Response.json({ skipped: 'referrer inactive' });

    const commissionAmt = (invoice.amount || 0) * (referrer.commission_percent || 0) / 100;
    if (commissionAmt <= 0) return Response.json({ skipped: 'zero commission' });

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

    // Record commission as a treasury egreso (saldo a favor del referidor)
    await base44.asServiceRole.entities.TreasuryTransaction.create({
      type: 'egreso',
      wallet: 'cuenta_firma',
      category: 'comision_referido',
      concept: `Comisión referido ${referrer.full_name} — Factura ${invoice.invoice_number || invoice.id} (${client.full_name})`,
      amount: commissionAmt,
      date: new Date().toISOString().split('T')[0],
      client_name: client.full_name,
      notes: `${referrer.commission_percent}% sobre factura pagada de ${client.full_name}. Referidor: ${referrer.full_name} CC ${referrer.cc}`,
    });

    // Notify all admin users about pending commission
    const users = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    await Promise.all(users.map(u =>
      base44.asServiceRole.entities.Notificacion.create({
        usuario_destino_id: u.id,
        usuario_destino_nombre: u.full_name,
        usuario_origen_nombre: 'Sistema',
        tipo: 'otro',
        mensaje: `💰 Comisión pendiente de pago: ${fmt(commissionAmt)} para ${referrer.full_name} por factura ${invoice.invoice_number || ''} de ${client.full_name}`,
        url: '/referrals',
        leido: false,
        email_enviado: false,
      })
    ));

    return Response.json({
      success: true,
      referrer: referrer.full_name,
      commission: commissionAmt,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
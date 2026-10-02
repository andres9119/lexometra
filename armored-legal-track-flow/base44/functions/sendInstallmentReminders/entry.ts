import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Solo puede ejecutarse como servicio (llamado por automatización)
    const installments = await base44.asServiceRole.entities.CreditInstallment.list();
    const agreements = await base44.asServiceRole.entities.CreditAgreement.list();
    const clients = await base44.asServiceRole.entities.Client.list();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const DAYS_BEFORE = [3, 1]; // Recordatorio 3 días y 1 día antes del vencimiento

    const agreementMap = {};
    for (const ag of agreements) {
      agreementMap[ag.id] = ag;
    }

    const clientMap = {};
    for (const cl of clients) {
      clientMap[cl.id] = cl;
      // También indexar por CC
      if (cl.cc) clientMap[cl.cc] = cl;
    }

    const results = [];

    for (const inst of installments) {
      if (inst.status !== 'pendiente' || !inst.due_date) continue;

      const dueDate = new Date(inst.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

      if (!DAYS_BEFORE.includes(diffDays)) continue;

      const agreement = agreementMap[inst.agreement_id];
      if (!agreement) continue;

      // Buscar cliente por client_id, luego por CC
      const client = clientMap[agreement.client_id] || clientMap[agreement.client_cc];
      if (!client || !client.email) continue;

      const fmtCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
      const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return d; } };

      const subject = diffDays === 1
        ? `⚠️ Recordatorio: Su cuota vence MAÑANA — ${agreement.description}`
        : `📅 Recordatorio: Su cuota vence en ${diffDays} días — ${agreement.description}`;

      const body = `
Estimado/a ${client.full_name},

Le recordamos que tiene una cuota próxima a vencer en su acuerdo de pago.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DETALLE DE LA CUOTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Acuerdo:       ${agreement.description}
  Cuota N°:      ${inst.installment_number} de ${agreement.num_installments}
  Valor a pagar: ${fmtCOP(inst.amount)}
  Fecha límite:  ${fmtDate(inst.due_date)}
  Días restantes: ${diffDays} día(s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por favor realice su pago antes de la fecha indicada para evitar recargos por mora.

Si ya realizó el pago, puede ignorar este mensaje.

Gracias por su confianza.
      `.trim();

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client.email,
        subject,
        body,
      });

      results.push({
        client: client.full_name,
        email: client.email,
        agreement: agreement.description,
        installment: inst.installment_number,
        due_date: inst.due_date,
        days_before: diffDays,
      });
    }

    return Response.json({
      success: true,
      reminders_sent: results.length,
      details: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
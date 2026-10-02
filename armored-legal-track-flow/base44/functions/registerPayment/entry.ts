/**
 * registerPayment — Cruce de pagos atómico + Recibo de Caja en PDF (base64)
 *
 * Payload esperado:
 *   transaction_data: { type, category, concept, amount, date, payment_method,
 *                       reference, client_name, wallet, notes, attachment_url }
 *   invoice_id?: string   — factura a afectar (obligatorio si category = pago_cliente)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.2.1';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n || 0);
}

/**
 * Very small helper: convert a number to Spanish words (up to billions).
 * Good enough for receipt amounts.
 */
function numberToWords(n) {
  const units = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
  const tens  = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const hundreds = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos',
    'seiscientos','setecientos','ochocientos','novecientos'];

  n = Math.round(n);
  if (n === 0) return 'cero';
  if (n < 0)   return 'menos ' + numberToWords(-n);
  if (n < 20)  return units[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' y ' + units[n%10] : '');
  if (n < 1000) {
    const h = Math.floor(n/100);
    const r = n % 100;
    return (h === 1 && r === 0 ? 'cien' : hundreds[h]) + (r ? ' ' + numberToWords(r) : '');
  }
  if (n < 1000000) {
    const m = Math.floor(n/1000);
    const r = n % 1000;
    return (m === 1 ? 'mil' : numberToWords(m) + ' mil') + (r ? ' ' + numberToWords(r) : '');
  }
  const m = Math.floor(n/1000000);
  const r = n % 1000000;
  return numberToWords(m) + (m === 1 ? ' millón' : ' millones') + (r ? ' ' + numberToWords(r) : '');
}

function buildReceiptPDF(data) {
  const { consecutive, date, client, amount, concept, payment_method, invoice_number } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RECIBO DE CAJA', 105, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text('FIRMA JURÍDICA', 105, 16, { align: 'center' });

  doc.setTextColor(30, 41, 59);

  // Consecutive + date box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`No. ${consecutive}`, 14, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Fecha: ${date}`, 150, 32);

  // Separator
  doc.setDrawColor(200, 200, 210);
  doc.line(14, 35, 196, 35);

  // Client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENTE:', 14, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(client || '—', 40, 43);

  // Concept
  doc.setFont('helvetica', 'bold');
  doc.text('CONCEPTO:', 14, 51);
  doc.setFont('helvetica', 'normal');
  const conceptLines = doc.splitTextToSize(concept || '—', 148);
  doc.text(conceptLines, 40, 51);
  const afterConcept = 51 + (conceptLines.length - 1) * 5;

  if (invoice_number) {
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA:', 14, afterConcept + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice_number, 40, afterConcept + 7);
  }

  // Payment method
  const pmY = afterConcept + 15;
  doc.setFont('helvetica', 'bold');
  doc.text('MEDIO DE PAGO:', 14, pmY);
  doc.setFont('helvetica', 'normal');
  doc.text((payment_method || '—').charAt(0).toUpperCase() + (payment_method || '').slice(1), 55, pmY);

  // Amount box
  const boxY = pmY + 8;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, boxY, 182, 22, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(fmtCOP(amount), 105, boxY + 12, { align: 'center' });
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const words = numberToWords(amount) + ' pesos colombianos';
  doc.text(words.charAt(0).toUpperCase() + words.slice(1), 105, boxY + 19, { align: 'center' });

  // Footer
  const footY = boxY + 40;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.line(14, footY, 90, footY);
  doc.text('Firma autorizada', 52, footY + 5, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 160);
  doc.text('Documento generado electrónicamente — válido sin firma física', 105, footY + 18, { align: 'center' });

  return doc.output('datauristring'); // base64 data URI
}

// ─── main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transaction_data, invoice_id } = await req.json();

    if (!transaction_data?.concept || !transaction_data?.amount) {
      return Response.json({ error: 'Concepto y monto son requeridos' }, { status: 400 });
    }

    const amount = parseFloat(transaction_data.amount) || 0;
    let invoice = null;
    let newInvoiceStatus = null;
    let invoice_number = null;

    // ── STEP 1: validate & fetch invoice if applicable ──────────────────
    if (transaction_data.category === 'pago_cliente' && invoice_id) {
      invoice = await base44.entities.Invoice.get(invoice_id);
      if (!invoice) {
        return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
      }
      const currentPaid = invoice.amount_paid || 0;
      const newPaid = currentPaid + amount;
      const total = invoice.amount || 0;

      if (newPaid >= total) {
        newInvoiceStatus = 'Pagada';
      } else {
        newInvoiceStatus = 'Pago_Parcial';
      }
      invoice_number = invoice.invoice_number;
    }

    // ── STEP 2: create treasury transaction ─────────────────────────────
    const tx = await base44.entities.TreasuryTransaction.create({
      ...transaction_data,
      amount,
      invoice_id: invoice_id || null,
    });

    // ── STEP 3: update invoice balance (if payment linked) ───────────────
    if (invoice && newInvoiceStatus) {
      const newPaid = (invoice.amount_paid || 0) + amount;
      await base44.asServiceRole.entities.Invoice.update(invoice_id, {
        amount_paid: newPaid,
        status: newInvoiceStatus,
        payment_method: transaction_data.payment_method || invoice.payment_method,
        payment_date: transaction_data.date || new Date().toISOString().split('T')[0],
      });
    }

    // ── STEP 3b: CLIENT HANDOFF — primer abono actualiza estado ─────────────
    // If the client is still in early stages (prospecto/contactado), the first
    // registered payment is the signal to advance them to peticion_radicada.
    if (invoice && invoice.client_id && newInvoiceStatus) {
      try {
        const handoffClient = await base44.asServiceRole.entities.Client.get(invoice.client_id);
        if (handoffClient && ['prospecto', 'contactado'].includes(handoffClient.status)) {
          await base44.asServiceRole.entities.Client.update(invoice.client_id, { status: 'peticion_radicada' });
          await base44.asServiceRole.entities.ClientAuditLog.create({
            client_id: invoice.client_id,
            entity_type: 'Client',
            entity_id: invoice.client_id,
            action: 'update',
            field_name: 'status',
            field_label: 'Estado',
            old_value: handoffClient.status,
            new_value: 'peticion_radicada',
            user_name: user.full_name || user.email || 'Sistema',
            user_id: user.id,
            summary: `Handoff automático: primer abono registrado — Estado actualizado a Petición Radicada`,
          });
        }
      } catch (handoffErr) {
        console.warn('Handoff non-blocking error:', handoffErr.message);
      }
    }

    // ── STEP 4: generate receipt PDF ─────────────────────────────────────
    // Build consecutive from tx.id or reference
    const consecutive = transaction_data.reference
      ? transaction_data.reference
      : `RC-${tx.id?.slice(-6).toUpperCase()}`;

    const concept = invoice_id
      ? `Abono a factura ${invoice_number || invoice_id} — ${transaction_data.concept}`
      : transaction_data.concept;

    const receiptBase64 = buildReceiptPDF({
      consecutive,
      date: transaction_data.date || new Date().toISOString().split('T')[0],
      client: transaction_data.client_name || '—',
      amount,
      concept,
      payment_method: transaction_data.payment_method,
      invoice_number,
    });

    return Response.json({
      success: true,
      transaction_id: tx.id,
      invoice_status: newInvoiceStatus,
      receipt_pdf_base64: receiptBase64,  // data URI string — frontend can trigger download
      consecutive,
    });

  } catch (error) {
    console.error('registerPayment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
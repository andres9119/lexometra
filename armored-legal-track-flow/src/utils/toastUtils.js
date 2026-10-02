import { toast } from 'sonner';

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

export const toastSuccess = (message) => {
  toast.success(`✅ ${message}`);
};

export const toastError = (message) => {
  toast.error(`❌ ${message}`);
};

export const toastInvoiceGenerated = (invoice) => {
  const message = `Nueva Factura Generada\nNo. Factura: ${invoice.invoice_number}\nCliente: ${invoice.client_name} ${invoice.client_cc ? `- ${invoice.client_cc}` : ''}\nConcepto: ${invoice.concept}\nMonto: ${fmt(invoice.amount)}`;
  toast.success(message, { duration: 6000 });
};

export const toastReportUpdated = (status, invoiceData = null) => {
  if (status === 'eliminado_exito' && invoiceData) {
    toastInvoiceGenerated(invoiceData);
  } else if (status === 'inviable') {
    toastSuccess('Reporte marcado como inviable');
  } else {
    toastSuccess('Estado del reporte actualizado');
  }
};
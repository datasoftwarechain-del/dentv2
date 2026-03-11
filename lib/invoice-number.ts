interface InvoiceLike {
  invoice_number: string;
  order?: {
    order_number?: string | null;
  } | null;
}

export function getInvoiceDisplayNumber(invoice: InvoiceLike): string {
  const orderNumber = invoice.order?.order_number?.trim();
  if (orderNumber) return orderNumber;
  return invoice.invoice_number;
}

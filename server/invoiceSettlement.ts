import type { Invoice, InvoiceStatus } from "@shared/schema";

// Pure, dependency-free invoice settlement logic shared by storage and routes.
// Kept free of DB/network imports so it can be unit-tested in isolation.

export interface InvoicePaymentUpdate {
  amountPaid: string;
  balance: string;
  status: InvoiceStatus;
}

// Mirrors the arithmetic used when applying a payment toward an invoice:
// accumulate the amount paid, recompute the outstanding balance, and flip the
// invoice to "paid" once the balance is fully covered. Unpaid invoices keep
// their existing status.
export function computeInvoicePayment(
  invoice: Pick<Invoice, "amountPaid" | "total" | "status">,
  amountPaid: string,
): InvoicePaymentUpdate {
  const totalPaid = (
    parseFloat(invoice.amountPaid || "0") + parseFloat(amountPaid)
  ).toFixed(2);
  const balance = (parseFloat(invoice.total) - parseFloat(totalPaid)).toFixed(2);
  const status: InvoiceStatus =
    parseFloat(balance) <= 0 ? "paid" : invoice.status;
  return { amountPaid: totalPaid, balance, status };
}

// Whether a linked invoice still needs settling when its payment is marked
// received. Invoices already "paid" (or with a zero/negative balance) are left
// alone so the operation is idempotent.
export function shouldSettleLinkedInvoice(
  invoice: Pick<Invoice, "status" | "balance">,
): boolean {
  const outstanding = parseFloat(invoice.balance ?? "0");
  return invoice.status !== "paid" && outstanding > 0;
}

// Fields used to revert a previously-paid invoice back to "sent" when its
// payment is moved away from "received": restore the full balance and clear the
// paid markers.
export function computeInvoiceRevert(
  invoice: Pick<Invoice, "total">,
): { status: InvoiceStatus; paidDate: null; amountPaid: null; balance: string } {
  return {
    status: "sent",
    paidDate: null,
    amountPaid: null,
    balance: invoice.total,
  };
}

// Minimal storage surface the settlement orchestration depends on. Real storage
// satisfies this; tests can supply an in-memory fake.
export interface InvoiceSettlementStorage {
  getInvoiceByPaymentId(paymentId: string): Promise<Invoice | undefined>;
  markInvoicePaid(
    id: string,
    paidDate: Date,
    amountPaid: string,
  ): Promise<Invoice | undefined>;
  updateInvoice(
    id: string,
    data: Partial<Invoice>,
  ): Promise<Invoice | undefined>;
}

// Loosely typed so the route's logActivityInternal (which uses literal-union
// action/entity types) is assignable here without importing those types.
export type ActivityLogger = (
  userId: string | null,
  action: any,
  entityType: any,
  entityId?: string,
  description?: string,
  req?: any,
) => Promise<unknown>;

// Settle a payment's linked invoice in full when that payment is marked received.
// We settle the entire OUTSTANDING balance (not just the net received amount) so
// the invoice reliably reaches "paid" — including AE invoices whose total
// includes VAT, where the net received amount alone would never cover the
// VAT-inclusive total. Idempotent (see shouldSettleLinkedInvoice). Returns the
// (updated or existing) invoice, or null when no invoice is linked.
export async function settleLinkedInvoiceForReceivedPayment(
  storage: InvoiceSettlementStorage,
  logActivity: ActivityLogger,
  paymentId: string,
  paidDate: Date,
  userId: string | null,
  req?: any,
): Promise<Invoice | null> {
  const linkedInvoice = await storage.getInvoiceByPaymentId(paymentId);
  if (!linkedInvoice) return null;

  if (!shouldSettleLinkedInvoice(linkedInvoice)) {
    return linkedInvoice;
  }

  const updated = await storage.markInvoicePaid(
    linkedInvoice.id,
    paidDate,
    linkedInvoice.balance,
  );
  await logActivity(
    userId,
    "update",
    "payment",
    linkedInvoice.id,
    `Marked invoice ${linkedInvoice.invoiceNumber} as paid via payment received`,
    req,
  );
  return updated ?? linkedInvoice;
}

// Revert a payment's linked invoice back to "sent" when the payment moves away
// from "received". Only a currently "paid" invoice is reverted. Returns the
// reverted invoice, or null when there is nothing to revert.
export async function revertLinkedInvoiceForUnreceivedPayment(
  storage: InvoiceSettlementStorage,
  logActivity: ActivityLogger,
  paymentId: string,
  newPaymentStatus: string,
  userId: string | null,
  req?: any,
): Promise<Invoice | undefined | null> {
  const linkedInvoice = await storage.getInvoiceByPaymentId(paymentId);
  if (!linkedInvoice || linkedInvoice.status !== "paid") {
    return null;
  }

  const reverted = await storage.updateInvoice(
    linkedInvoice.id,
    computeInvoiceRevert(linkedInvoice),
  );
  await logActivity(
    userId,
    "update",
    "payment",
    linkedInvoice.id,
    `Reverted invoice ${linkedInvoice.invoiceNumber} status to sent (payment status changed to ${newPaymentStatus})`,
    req,
  );
  return reverted ?? linkedInvoice;
}

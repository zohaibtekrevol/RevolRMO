import { test } from "node:test";
import assert from "node:assert/strict";
import type { Invoice } from "@shared/schema";
import {
  computeInvoicePayment,
  settleLinkedInvoiceForReceivedPayment,
  revertLinkedInvoiceForUnreceivedPayment,
  type InvoiceSettlementStorage,
  type ActivityLogger,
} from "./invoiceSettlement";

// Build a minimal invoice with sensible defaults; override per test.
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-0001",
    paymentId: "pay-1",
    status: "sent",
    total: "100.00",
    amountPaid: "0",
    balance: "100.00",
    paidDate: null,
    ...(overrides as any),
  } as Invoice;
}

// In-memory storage faithful to production: markInvoicePaid reuses the same pure
// arithmetic (computeInvoicePayment) the real DB-backed storage uses, so the
// idempotency guard is exercised exactly as in production. A no-op activity
// logger stands in for the DB-backed audit log.
function makeFakeStorage(initial: Invoice) {
  const store = new Map<string, Invoice>();
  store.set(initial.id, { ...initial });
  let markInvoicePaidCalls = 0;
  let updateInvoiceCalls = 0;
  const lastMarkArgs: { id: string; paidDate: Date; amountPaid: string }[] = [];

  const storage: InvoiceSettlementStorage = {
    async getInvoiceByPaymentId(paymentId: string) {
      return Array.from(store.values()).find((i) => i.paymentId === paymentId);
    },
    async markInvoicePaid(id: string, paidDate: Date, amountPaid: string) {
      markInvoicePaidCalls++;
      lastMarkArgs.push({ id, paidDate, amountPaid });
      const inv = store.get(id);
      if (!inv) return undefined;
      const fields = computeInvoicePayment(inv, amountPaid);
      const updated: Invoice = { ...inv, ...fields, paidDate } as Invoice;
      store.set(id, updated);
      return updated;
    },
    async updateInvoice(id: string, data: Partial<Invoice>) {
      updateInvoiceCalls++;
      const inv = store.get(id);
      if (!inv) return undefined;
      const updated = { ...inv, ...data } as Invoice;
      store.set(id, updated);
      return updated;
    },
  };

  return {
    storage,
    store,
    stats: () => ({ markInvoicePaidCalls, updateInvoiceCalls, lastMarkArgs }),
  };
}

const noopLogger: ActivityLogger = async () => {};

const PAID_DATE = new Date("2026-06-24T00:00:00.000Z");

test("marking a non-UAE payment received settles its linked invoice to paid", async () => {
  const fake = makeFakeStorage(
    makeInvoice({ total: "100.00", balance: "100.00", amountPaid: "0", status: "sent" }),
  );

  const result = await settleLinkedInvoiceForReceivedPayment(
    fake.storage,
    noopLogger,
    "pay-1",
    PAID_DATE,
    "user-1",
  );

  assert.ok(result, "expected an invoice to be returned");
  assert.equal(result!.status, "paid");
  assert.equal(parseFloat(result!.balance), 0);
  assert.equal(result!.amountPaid, "100.00");
  assert.deepEqual(result!.paidDate, PAID_DATE);
});

test("marking a UAE (VAT-inclusive) payment received settles the full VAT total to paid", async () => {
  // AE invoice: net 100 + 5% VAT = 105 total. The net received amount alone (100)
  // would never cover the VAT-inclusive total; settling the full balance must.
  const fake = makeFakeStorage(
    makeInvoice({
      id: "inv-ae",
      paymentId: "pay-ae",
      total: "105.00",
      balance: "105.00",
      amountPaid: "0",
      status: "sent",
    }),
  );

  const result = await settleLinkedInvoiceForReceivedPayment(
    fake.storage,
    noopLogger,
    "pay-ae",
    PAID_DATE,
    "user-1",
  );

  assert.ok(result);
  assert.equal(result!.status, "paid");
  assert.equal(parseFloat(result!.balance), 0);
  assert.equal(result!.amountPaid, "105.00");
  assert.deepEqual(result!.paidDate, PAID_DATE);
  // Confirms the full outstanding balance (not the net amount) was settled.
  assert.equal(fake.stats().lastMarkArgs[0].amountPaid, "105.00");
});

test("settling is idempotent: the receipt path does not double-count amountPaid", async () => {
  const fake = makeFakeStorage(
    makeInvoice({ total: "105.00", balance: "105.00", amountPaid: "0", status: "sent" }),
  );

  // First settle (e.g. PATCH payment -> received).
  const first = await settleLinkedInvoiceForReceivedPayment(
    fake.storage,
    noopLogger,
    "pay-1",
    PAID_DATE,
    "user-1",
  );
  // Second settle (e.g. the mark-invoice-paid safety-net endpoint runs again).
  const second = await settleLinkedInvoiceForReceivedPayment(
    fake.storage,
    noopLogger,
    "pay-1",
    PAID_DATE,
    "user-1",
  );

  assert.equal(first!.amountPaid, "105.00");
  assert.equal(second!.status, "paid");
  assert.equal(second!.amountPaid, "105.00", "amountPaid must not double-count");
  assert.equal(parseFloat(second!.balance), 0);
  // The second call short-circuits and never re-runs markInvoicePaid.
  assert.equal(fake.stats().markInvoicePaidCalls, 1);
});

test("reverting a payment away from received restores the invoice to sent with full balance", async () => {
  // Start from an already-paid invoice (payment was previously received).
  const fake = makeFakeStorage(
    makeInvoice({
      total: "105.00",
      balance: "0.00",
      amountPaid: "105.00",
      status: "paid",
      paidDate: PAID_DATE,
    }),
  );

  const result = await revertLinkedInvoiceForUnreceivedPayment(
    fake.storage,
    noopLogger,
    "pay-1",
    "pending_invoice",
    "user-1",
  );

  assert.ok(result);
  assert.equal(result!.status, "sent");
  assert.equal(result!.balance, "105.00", "balance restored to full total");
  assert.equal(result!.paidDate, null);
  assert.equal(result!.amountPaid, null);
});

test("reverting does nothing when the linked invoice is not paid", async () => {
  const fake = makeFakeStorage(
    makeInvoice({ status: "sent", balance: "100.00", amountPaid: "0" }),
  );

  const result = await revertLinkedInvoiceForUnreceivedPayment(
    fake.storage,
    noopLogger,
    "pay-1",
    "pending_invoice",
    "user-1",
  );

  assert.equal(result, null);
  assert.equal(fake.stats().updateInvoiceCalls, 0);
});

// Pure helpers for the Statement of Account ledger.
// Extracted from the /api/reports/payments/ledger route so the computation
// rules can be verified by unit tests without a database or HTTP server.

export type StatementEntry = {
  id: string;
  source: "payment" | "milestone" | "installment";
  type: "recurring" | "upsell" | "milestone";
  description: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  status: string;
  date: Date | string | null;
  invoiceDate: Date | string | null;
  dueDate: Date | string | null;
  receivedDate: Date | string | null;
  debit: number;
  credit: number;
  balance: number;
};

// A minimal view of a milestone as required by buildMilestoneLedgerEntry.
export type LedgerMilestone = {
  id: string;
  name: string;
  status: string;
  expectedAmount: string | number | null;
  receivedAmount: string | number | null;
  paymentId?: string | null;
  invoicedDate?: Date | string | null;
  dueDate?: Date | string | null;
  paidDate?: Date | string | null;
  createdAt?: Date | string | null;
};

// A minimal invoice view for ledger line annotation.
export type LedgerInvoice = {
  invoiceNumber: string;
  status: string;
};

// Strip any client-unfriendly internal wording from free-text fields.
// The word "upsell" must NEVER reach a client-facing statement.
export function sanitizeClientText(text: string): string {
  return text.replace(/upsells?/gi, "Additional Services");
}

// Build a single statement line for a milestone that is shown on the ledger
// (status === "paid" or "partially_paid"). The caller is responsible for
// ensuring only shown milestones are passed in.
//
// Financial rules:
//   - debit  = expectedAmount (what the client was charged)
//   - credit = receivedAmount, EXCEPT when status==="paid" and received===0,
//              in which case credit=expected (full amount received, just not
//              recorded — e.g. mobilisation paid up front).
//   - For partially_paid milestones the received amount is NEVER inflated to
//     expected — that would misrepresent how much has actually been collected.
//   - status on the ledger line: "partially_paid" | "received"
export function buildMilestoneLedgerEntry(
  milestone: LedgerMilestone,
  linkedPaymentId: string | null,
  invoice: LedgerInvoice | null | undefined,
): StatementEntry {
  const expected = parseFloat(milestone.expectedAmount?.toString() || "0");
  const received = parseFloat(milestone.receivedAmount?.toString() || "0");
  const effectiveReceived =
    milestone.status === "paid" && received === 0 ? expected : received;

  return {
    id: `milestone-${milestone.id}`,
    source: "milestone",
    type: "milestone",
    description: sanitizeClientText(milestone.name),
    invoiceNumber: invoice?.invoiceNumber ?? null,
    invoiceStatus: invoice?.status ?? null,
    status: milestone.status === "partially_paid" ? "partially_paid" : "received",
    date: milestone.invoicedDate || milestone.dueDate || milestone.paidDate || milestone.createdAt || null,
    invoiceDate: milestone.invoicedDate ?? null,
    dueDate: milestone.dueDate ?? null,
    receivedDate: milestone.paidDate ?? null,
    debit: expected,
    credit: effectiveReceived,
    balance: 0,
  };
}

// Fill in the running balance on a sorted (oldest-first) array of statement
// entries. Mutates entries in place and returns the same array.
// Balance accumulates as: balance[i] = balance[i-1] + debit[i] - credit[i]
export function applyRunningBalance(entries: StatementEntry[]): StatementEntry[] {
  let running = 0;
  for (const e of entries) {
    running += e.debit - e.credit;
    e.balance = running;
  }
  return entries;
}

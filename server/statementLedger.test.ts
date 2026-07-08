import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMilestoneLedgerEntry,
  applyRunningBalance,
  sanitizeClientText,
  type LedgerMilestone,
  type StatementEntry,
} from "./statementLedger";

// ---------------------------------------------------------------------------
// sanitizeClientText
// ---------------------------------------------------------------------------

test("sanitizeClientText: replaces upsell with Additional Services", () => {
  assert.equal(sanitizeClientText("Upsell Phase 2"), "Additional Services Phase 2");
  assert.equal(sanitizeClientText("upsells approved"), "Additional Services approved");
  assert.equal(sanitizeClientText("Milestone 1"), "Milestone 1");
});

// ---------------------------------------------------------------------------
// buildMilestoneLedgerEntry — paid milestones
// ---------------------------------------------------------------------------

test("buildMilestoneLedgerEntry: paid milestone with received amount records debit=expected, credit=received", () => {
  const m: LedgerMilestone = {
    id: "m-1",
    name: "Mobilisation",
    status: "paid",
    expectedAmount: "10000",
    receivedAmount: "10000",
    dueDate: new Date("2025-01-15"),
  };
  const entry = buildMilestoneLedgerEntry(m, null, null);
  assert.equal(entry.id, "milestone-m-1");
  assert.equal(entry.source, "milestone");
  assert.equal(entry.type, "milestone");
  assert.equal(entry.description, "Mobilisation");
  assert.equal(entry.status, "received");
  assert.equal(entry.debit, 10000);
  assert.equal(entry.credit, 10000);
  assert.equal(entry.balance, 0);
  assert.equal(entry.invoiceNumber, null);
});

test("buildMilestoneLedgerEntry: paid milestone with receivedAmount=0 inflates credit to expected", () => {
  // e.g. mobilisation recorded as 'paid' but receivedAmount not filled in.
  const m: LedgerMilestone = {
    id: "m-2",
    name: "Mobilisation",
    status: "paid",
    expectedAmount: "5000",
    receivedAmount: "0",
    dueDate: new Date("2025-02-01"),
  };
  const entry = buildMilestoneLedgerEntry(m, null, null);
  assert.equal(entry.status, "received");
  assert.equal(entry.debit, 5000);
  assert.equal(entry.credit, 5000, "credit must equal expected when paid but receivedAmount=0");
});

// ---------------------------------------------------------------------------
// buildMilestoneLedgerEntry — partially_paid milestones (the critical case)
// ---------------------------------------------------------------------------

test("buildMilestoneLedgerEntry: partially_paid milestone carries correct split amounts", () => {
  // A milestone worth 20 000, of which 8 000 has been received so far.
  // Two payments are linked: one received (8 000) and one pending (12 000).
  // The milestone row itself summarises both: expectedAmount=20000, receivedAmount=8000.
  const m: LedgerMilestone = {
    id: "m-3",
    name: "Design Phase",
    status: "partially_paid",
    expectedAmount: "20000",
    receivedAmount: "8000",
    dueDate: new Date("2025-03-31"),
    paidDate: null,
  };
  const entry = buildMilestoneLedgerEntry(m, null, null);
  assert.equal(entry.status, "partially_paid", "status must be partially_paid");
  assert.equal(entry.debit, 20000, "debit must equal the total milestone amount");
  assert.equal(entry.credit, 8000, "credit must equal only the received amount");
  assert.equal(entry.balance, 0, "balance is 0 before applyRunningBalance");
});

test("buildMilestoneLedgerEntry: partially_paid milestone with receivedAmount=0 does NOT inflate credit", () => {
  // Unlike a fully paid milestone, a partially_paid one must NEVER inflate
  // credit to expected — even if receivedAmount is 0 in the DB (race or bug).
  const m: LedgerMilestone = {
    id: "m-4",
    name: "Design Phase",
    status: "partially_paid",
    expectedAmount: "20000",
    receivedAmount: "0",
  };
  const entry = buildMilestoneLedgerEntry(m, null, null);
  assert.equal(entry.status, "partially_paid");
  assert.equal(entry.debit, 20000);
  assert.equal(entry.credit, 0, "credit must NOT be inflated to expected for partially_paid");
});

test("buildMilestoneLedgerEntry: partially_paid milestone annotates invoice when provided", () => {
  const m: LedgerMilestone = {
    id: "m-5",
    name: "Phase 2",
    status: "partially_paid",
    expectedAmount: "15000",
    receivedAmount: "5000",
    invoicedDate: new Date("2025-04-01"),
  };
  const inv = { invoiceNumber: "INV-2025-0042", status: "partially_paid" };
  const entry = buildMilestoneLedgerEntry(m, "pay-abc", inv);
  assert.equal(entry.invoiceNumber, "INV-2025-0042");
  assert.equal(entry.invoiceStatus, "partially_paid");
  assert.equal(entry.debit, 15000);
  assert.equal(entry.credit, 5000);
});

// ---------------------------------------------------------------------------
// applyRunningBalance — verifies the running balance accumulates correctly
// ---------------------------------------------------------------------------

test("applyRunningBalance: correctly accumulates debit-credit across ledger entries", () => {
  // Scenario: a milestone of 20 000, partially paid with 8 000 received.
  // Outstanding balance = 20 000 - 8 000 = 12 000.
  const entry: StatementEntry = {
    id: "milestone-m-3",
    source: "milestone",
    type: "milestone",
    description: "Design Phase",
    invoiceNumber: null,
    invoiceStatus: null,
    status: "partially_paid",
    date: new Date("2025-03-31"),
    invoiceDate: null,
    dueDate: new Date("2025-03-31"),
    receivedDate: null,
    debit: 20000,
    credit: 8000,
    balance: 0,
  };

  applyRunningBalance([entry]);

  const outstanding = entry.debit - entry.credit;
  assert.equal(entry.balance, outstanding, "balance must equal outstanding (debit - credit)");
  assert.equal(entry.balance, 12000);
});

test("applyRunningBalance: multi-entry running balance accumulates correctly", () => {
  // Recurring 5 000, then partially-paid milestone 20 000 / 8 000 received.
  // After entry 1: running = 5 000 - 5 000 = 0
  // After entry 2: running = 0 + 20 000 - 8 000 = 12 000
  const entries: StatementEntry[] = [
    {
      id: "pay-1",
      source: "payment",
      type: "recurring",
      description: "Monthly Retainer",
      invoiceNumber: null,
      invoiceStatus: null,
      status: "received",
      date: new Date("2025-02-01"),
      invoiceDate: null,
      dueDate: null,
      receivedDate: null,
      debit: 5000,
      credit: 5000,
      balance: 0,
    },
    {
      id: "milestone-m-3",
      source: "milestone",
      type: "milestone",
      description: "Design Phase",
      invoiceNumber: null,
      invoiceStatus: null,
      status: "partially_paid",
      date: new Date("2025-03-31"),
      invoiceDate: null,
      dueDate: null,
      receivedDate: null,
      debit: 20000,
      credit: 8000,
      balance: 0,
    },
  ];

  applyRunningBalance(entries);

  assert.equal(entries[0].balance, 0, "fully paid entry leaves no outstanding balance");
  assert.equal(entries[1].balance, 12000, "outstanding = total debit 20 000 - received 8 000 = 12 000");
});

// ---------------------------------------------------------------------------
// End-to-end: build entry + apply balance (mirrors the ledger route flow)
// ---------------------------------------------------------------------------

test("milestone ledger end-to-end: partially-paid milestone in a single-entry ledger", () => {
  // Mirrors the route: build entry, apply running balance, check totals.
  const m: LedgerMilestone = {
    id: "m-e2e",
    name: "Development Milestone",
    status: "partially_paid",
    expectedAmount: "30000",
    receivedAmount: "12000",
    dueDate: new Date("2025-05-15"),
  };

  const entries = [buildMilestoneLedgerEntry(m, null, null)] as StatementEntry[];
  applyRunningBalance(entries);

  const [entry] = entries;
  assert.equal(entry.status, "partially_paid");
  assert.equal(entry.debit, 30000, "debit = total milestone charge");
  assert.equal(entry.credit, 12000, "credit = received so far");
  assert.equal(entry.balance, 18000, "balance = outstanding (30 000 - 12 000)");

  const totalCharged = entries.reduce((s, e) => s + e.debit, 0);
  const totalReceived = entries.reduce((s, e) => s + e.credit, 0);
  assert.equal(totalCharged, 30000);
  assert.equal(totalReceived, 12000);
  assert.equal(totalCharged - totalReceived, 18000, "outstanding = totalCharged - totalReceived");
});

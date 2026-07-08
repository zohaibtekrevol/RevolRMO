// Auto-uploads generated invoice and payment-receipt PDFs to a project's Google
// Drive subfolders. The PDFs are produced by the SAME shared generator the browser
// uses (@shared/invoice-generator), so any future template change applies to both
// the in-app download and the Drive copy automatically.
//
// All uploads are fail-soft: a Drive outage (or a missing Google connection) must
// never break the core invoice/payment action. Callers fire-and-forget these.
import { format } from "date-fns";
import { buildInvoiceDoc, invoiceFileName } from "@shared/invoice-generator";
import { storage } from "../storage";
import { type drive_v3 } from "googleapis";
import { getOrCreateProjectFolders } from "./projectFolders";
import {
  getUncachableDriveClient,
  uploadFileToFolder,
  listFolderChildren,
} from "./driveService";

const PDF_MIME = "application/pdf";

// jsPDF runs under Node; convert its output to a Buffer for the Drive upload.
function docToBuffer(doc: { output: (type: "arraybuffer") => ArrayBuffer }): Buffer {
  return Buffer.from(doc.output("arraybuffer"));
}

// Idempotent upload: skip if a file with the same name already lives in the folder.
// This lets us safely backfill missing copies (e.g. invoices generated before Drive
// auto-upload existed) without creating duplicates when the action is repeated.
async function uploadFileIfAbsent(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  mimeType: string,
  content: Buffer,
): Promise<void> {
  const existing = await listFolderChildren(drive, folderId);
  if (existing.some((f) => f.name === fileName)) {
    return;
  }
  await uploadFileToFolder(drive, folderId, fileName, mimeType, content);
}

function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return format(new Date(), "yyyy-MM-dd");
  const d = new Date(value);
  return isNaN(d.getTime()) ? format(new Date(), "yyyy-MM-dd") : format(d, "yyyy-MM-dd");
}

// Upload a generated invoice PDF to the project's "Invoices" Drive subfolder.
// Mirrors the in-browser "Download Invoice" flow (payment-based generator).
export async function uploadInvoicePdfToDrive(opts: {
  paymentId: string;
  invoiceNumber: string;
  invoiceDate?: string | Date | null;
  description?: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    const payment = await storage.getPaymentWithProject(opts.paymentId);
    if (!payment?.project) {
      console.warn(`[drive] Skipping invoice upload: payment/project missing for ${opts.paymentId}`);
      return;
    }
    const region = payment.project.region;
    const banking = region ? await storage.getBankingDetailsByRegion(region) : undefined;
    if (!banking) {
      console.warn(`[drive] Skipping invoice upload: no banking details for region ${region}`);
      return;
    }

    const doc = buildInvoiceDoc({
      payment,
      banking,
      invoiceNumber: opts.invoiceNumber,
      invoiceDate: formatDateOnly(opts.invoiceDate),
      description:
        opts.description ||
        payment.narration ||
        `${payment.project.name} - ${payment.project.phase || "Services"}`,
      notes: opts.notes || "",
    });

    const folders = await getOrCreateProjectFolders(payment.projectId);
    const drive = await getUncachableDriveClient();
    await uploadFileIfAbsent(
      drive,
      folders.invoicesFolderId,
      invoiceFileName({ invoiceNumber: opts.invoiceNumber, isReceipt: false }),
      PDF_MIME,
      docToBuffer(doc),
    );
  } catch (err) {
    console.error(`[drive] Failed to upload invoice PDF for payment ${opts.paymentId}:`, err);
  }
}

// Upload a payment-receipt PDF to the project's "Payment Receipts" Drive subfolder
// when a payment becomes received. Mirrors the in-browser receipt flow: prefer the
// linked invoice's number/date/notes, otherwise fall back to a generated receipt
// number so payments without an invoice record still get a receipt.
export async function uploadReceiptPdfToDrive(paymentId: string): Promise<void> {
  try {
    const payment = await storage.getPaymentWithProject(paymentId);
    if (!payment?.project) {
      console.warn(`[drive] Skipping receipt upload: payment/project missing for ${paymentId}`);
      return;
    }
    const region = payment.project.region;
    const banking = region ? await storage.getBankingDetailsByRegion(region) : undefined;
    if (!banking) {
      console.warn(`[drive] Skipping receipt upload: no banking details for region ${region}`);
      return;
    }

    let receiptNumber = `INV-${format(new Date(), "yyyyMMdd")}-${payment.id.slice(0, 8).toUpperCase()}`;
    let receiptDate = payment.receivedDate
      ? format(new Date(payment.receivedDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    let receiptNotes = "";

    const linkedInvoice = await storage.getInvoiceByPaymentId(paymentId);
    if (linkedInvoice?.invoiceNumber) {
      receiptNumber = linkedInvoice.invoiceNumber;
      if (linkedInvoice.issueDate) {
        receiptDate = format(new Date(linkedInvoice.issueDate), "yyyy-MM-dd");
      }
      if (linkedInvoice.notes) {
        receiptNotes = linkedInvoice.notes;
      }
    }

    const doc = buildInvoiceDoc({
      payment,
      banking,
      invoiceNumber: receiptNumber,
      invoiceDate: receiptDate,
      description:
        payment.narration ||
        `${payment.project.name} - ${payment.project.phase || "Services"}`,
      notes: receiptNotes,
      isReceipt: true,
      receivedDate: payment.receivedDate,
    });

    const folders = await getOrCreateProjectFolders(payment.projectId);
    const drive = await getUncachableDriveClient();
    await uploadFileIfAbsent(
      drive,
      folders.paymentReceiptsFolderId,
      invoiceFileName({ invoiceNumber: receiptNumber, isReceipt: true }),
      PDF_MIME,
      docToBuffer(doc),
    );
  } catch (err) {
    console.error(`[drive] Failed to upload receipt PDF for payment ${paymentId}:`, err);
  }
}

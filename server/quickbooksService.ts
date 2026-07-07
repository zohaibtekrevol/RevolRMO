import QuickBooks from "node-quickbooks";
import crypto from "crypto";
import { db } from "./db";
import {
  quickbooksSettings,
  quickbooksCustomerMapping,
  quickbooksInvoiceSync,
  quickbooksPaymentSync,
  quickbooksWebhookEvents,
  invoices,
  type QuickbooksSettings,
  type Invoice,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "";
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "";
const QUICKBOOKS_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || "";
const QUICKBOOKS_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export async function getQuickbooksSettings(): Promise<QuickbooksSettings | null> {
  const [settings] = await db.select().from(quickbooksSettings).limit(1);
  return settings || null;
}

export async function saveQuickbooksSettings(data: Partial<QuickbooksSettings>): Promise<QuickbooksSettings> {
  const existing = await getQuickbooksSettings();
  
  if (existing) {
    const [updated] = await db
      .update(quickbooksSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quickbooksSettings.id, existing.id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(quickbooksSettings)
      .values(data as any)
      .returning();
    return created;
  }
}

export function getAuthorizationUrl(state: string): string {
  const scopes = encodeURIComponent("com.intuit.quickbooks.accounting");
  return `https://appcenter.intuit.com/connect/oauth2?client_id=${QUICKBOOKS_CLIENT_ID}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(QUICKBOOKS_REDIRECT_URI)}&state=${state}`;
}

export async function exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
  const authHeader = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
  
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: QUICKBOOKS_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const tokens: TokenResponse = await response.json();
  
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000);
  
  await saveQuickbooksSettings({
    isConnected: true,
    realmId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt,
    refreshTokenExpiresAt,
    webhookVerifierToken: crypto.randomBytes(32).toString("hex"),
  });
}

export async function refreshAccessToken(): Promise<string | null> {
  const settings = await getQuickbooksSettings();
  if (!settings?.refreshToken) {
    return null;
  }

  const authHeader = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
  
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: settings.refreshToken,
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh QuickBooks token");
    return null;
  }

  const tokens: TokenResponse = await response.json();
  
  await saveQuickbooksSettings({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
  });

  return tokens.access_token;
}

export async function getQuickbooksClient(): Promise<QuickBooks | null> {
  const settings = await getQuickbooksSettings();
  if (!settings?.isConnected || !settings.accessToken || !settings.realmId) {
    return null;
  }

  if (settings.tokenExpiresAt && new Date(settings.tokenExpiresAt) < new Date()) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      return null;
    }
    settings.accessToken = newToken;
  }

  const useSandbox = QUICKBOOKS_ENVIRONMENT === "sandbox";
  
  return new QuickBooks(
    QUICKBOOKS_CLIENT_ID,
    QUICKBOOKS_CLIENT_SECRET,
    settings.accessToken,
    false,
    settings.realmId,
    useSandbox,
    false,
    null,
    "2.0",
    settings.refreshToken
  );
}

export async function disconnectQuickbooks(): Promise<void> {
  const settings = await getQuickbooksSettings();
  if (settings) {
    await db
      .update(quickbooksSettings)
      .set({
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        realmId: null,
        updatedAt: new Date(),
      })
      .where(eq(quickbooksSettings.id, settings.id));
  }
}

export async function findOrCreateCustomer(qbo: QuickBooks, clientName: string, clientEmail?: string | null): Promise<string> {
  const existingMapping = await db
    .select()
    .from(quickbooksCustomerMapping)
    .where(eq(quickbooksCustomerMapping.clientName, clientName))
    .limit(1);

  if (existingMapping.length > 0) {
    return existingMapping[0].quickbooksCustomerId;
  }

  return new Promise((resolve, reject) => {
    qbo.findCustomers({ DisplayName: clientName }, (err: any, customers: any) => {
      if (err) {
        if (err.Fault?.Error?.[0]?.Message?.includes("doesn't exist")) {
          const customerData: any = {
            DisplayName: clientName,
          };
          if (clientEmail) {
            customerData.PrimaryEmailAddr = { Address: clientEmail };
          }

          qbo.createCustomer(customerData, async (createErr: any, customer: any) => {
            if (createErr) {
              reject(createErr);
              return;
            }
            
            await db.insert(quickbooksCustomerMapping).values({
              clientName,
              quickbooksCustomerId: customer.Id,
              quickbooksCustomerName: customer.DisplayName,
            });
            
            resolve(customer.Id);
          });
        } else {
          reject(err);
        }
        return;
      }

      if (customers?.QueryResponse?.Customer?.length > 0) {
        const customer = customers.QueryResponse.Customer[0];
        
        db.insert(quickbooksCustomerMapping).values({
          clientName,
          quickbooksCustomerId: customer.Id,
          quickbooksCustomerName: customer.DisplayName,
        }).then(() => {
          resolve(customer.Id);
        }).catch(reject);
      } else {
        const customerData: any = {
          DisplayName: clientName,
        };
        if (clientEmail) {
          customerData.PrimaryEmailAddr = { Address: clientEmail };
        }

        qbo.createCustomer(customerData, async (createErr: any, customer: any) => {
          if (createErr) {
            reject(createErr);
            return;
          }
          
          await db.insert(quickbooksCustomerMapping).values({
            clientName,
            quickbooksCustomerId: customer.Id,
            quickbooksCustomerName: customer.DisplayName,
          });
          
          resolve(customer.Id);
        });
      }
    });
  });
}

export async function syncInvoiceToQuickbooks(invoice: Invoice & { lineItems?: any[] }): Promise<{ success: boolean; quickbooksInvoiceId?: string; error?: string }> {
  const qbo = await getQuickbooksClient();
  if (!qbo) {
    return { success: false, error: "QuickBooks not connected" };
  }

  try {
    const existingSync = await db
      .select()
      .from(quickbooksInvoiceSync)
      .where(eq(quickbooksInvoiceSync.invoiceId, invoice.id))
      .limit(1);

    if (existingSync.length > 0 && existingSync[0].syncStatus === "synced") {
      return { success: true, quickbooksInvoiceId: existingSync[0].quickbooksInvoiceId };
    }

    const customerId = await findOrCreateCustomer(qbo, invoice.clientName, invoice.clientEmail);

    const lineItems = invoice.lineItems?.map((item, index) => ({
      Id: String(index + 1),
      LineNum: index + 1,
      Amount: parseFloat(item.total),
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: "1",
          name: "Services",
        },
        UnitPrice: parseFloat(item.unitPrice),
        Qty: item.quantity,
      },
      Description: item.description,
    })) || [{
      Id: "1",
      LineNum: 1,
      Amount: parseFloat(invoice.total),
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: "1",
          name: "Services",
        },
        UnitPrice: parseFloat(invoice.total),
        Qty: 1,
      },
      Description: `Invoice ${invoice.invoiceNumber}`,
    }];

    const invoiceData = {
      CustomerRef: {
        value: customerId,
      },
      Line: lineItems,
      DocNumber: invoice.invoiceNumber,
      TxnDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split("T")[0] : undefined,
      DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : undefined,
      CustomerMemo: {
        value: invoice.notes || "",
      },
    };

    return new Promise((resolve) => {
      qbo.createInvoice(invoiceData, async (err: any, qbInvoice: any) => {
        if (err) {
          console.error("QuickBooks invoice creation error:", err);
          
          if (existingSync.length > 0) {
            await db
              .update(quickbooksInvoiceSync)
              .set({
                syncStatus: "error",
                lastError: JSON.stringify(err),
                updatedAt: new Date(),
              })
              .where(eq(quickbooksInvoiceSync.id, existingSync[0].id));
          } else {
            await db.insert(quickbooksInvoiceSync).values({
              invoiceId: invoice.id,
              quickbooksInvoiceId: "",
              syncStatus: "error",
              lastError: JSON.stringify(err),
            });
          }

          resolve({ success: false, error: err.Fault?.Error?.[0]?.Message || "Failed to create invoice in QuickBooks" });
          return;
        }

        if (existingSync.length > 0) {
          await db
            .update(quickbooksInvoiceSync)
            .set({
              quickbooksInvoiceId: qbInvoice.Id,
              quickbooksDocNumber: qbInvoice.DocNumber,
              syncStatus: "synced",
              lastSyncAt: new Date(),
              lastError: null,
              quickbooksData: qbInvoice,
              updatedAt: new Date(),
            })
            .where(eq(quickbooksInvoiceSync.id, existingSync[0].id));
        } else {
          await db.insert(quickbooksInvoiceSync).values({
            invoiceId: invoice.id,
            quickbooksInvoiceId: qbInvoice.Id,
            quickbooksDocNumber: qbInvoice.DocNumber,
            syncStatus: "synced",
            quickbooksData: qbInvoice,
          });
        }

        await saveQuickbooksSettings({ lastSyncAt: new Date() });

        resolve({ success: true, quickbooksInvoiceId: qbInvoice.Id });
      });
    });
  } catch (error: any) {
    console.error("Error syncing invoice to QuickBooks:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export function verifyWebhookSignature(payload: string, signature: string, verifierToken: string): boolean {
  const hash = crypto
    .createHmac("sha256", verifierToken)
    .update(payload)
    .digest("base64");
  
  return hash === signature;
}

export async function processWebhookEvent(
  eventType: string,
  operation: string,
  entityId: string,
  realmId: string,
  rawPayload: any
): Promise<void> {
  await db.insert(quickbooksWebhookEvents).values({
    eventType,
    operation,
    entityId,
    realmId,
    rawPayload,
  });

  if (eventType === "Payment" && (operation === "Create" || operation === "Update")) {
    await processPaymentWebhook(entityId);
  }
}

async function processPaymentWebhook(paymentId: string): Promise<void> {
  const qbo = await getQuickbooksClient();
  if (!qbo) {
    console.error("Cannot process payment webhook: QuickBooks not connected");
    return;
  }

  return new Promise((resolve) => {
    qbo.getPayment(paymentId, async (err: any, payment: any) => {
      if (err) {
        console.error("Error fetching payment from QuickBooks:", err);
        
        await db
          .update(quickbooksWebhookEvents)
          .set({ error: JSON.stringify(err) })
          .where(eq(quickbooksWebhookEvents.entityId, paymentId));
        
        resolve();
        return;
      }

      const existingPaymentSync = await db
        .select()
        .from(quickbooksPaymentSync)
        .where(eq(quickbooksPaymentSync.quickbooksPaymentId, paymentId))
        .limit(1);

      if (existingPaymentSync.length > 0 && existingPaymentSync[0].processed) {
        resolve();
        return;
      }

      const linkedInvoices = payment.Line?.filter((line: any) => 
        line.LinkedTxn?.some((txn: any) => txn.TxnType === "Invoice")
      );

      if (!linkedInvoices?.length) {
        resolve();
        return;
      }

      for (const line of linkedInvoices) {
        const invoiceTxn = line.LinkedTxn?.find((txn: any) => txn.TxnType === "Invoice");
        if (!invoiceTxn) continue;

        const qbInvoiceId = invoiceTxn.TxnId;
        
        const invoiceSync = await db
          .select()
          .from(quickbooksInvoiceSync)
          .where(eq(quickbooksInvoiceSync.quickbooksInvoiceId, qbInvoiceId))
          .limit(1);

        if (invoiceSync.length === 0) continue;

        const localInvoiceId = invoiceSync[0].invoiceId;
        const amount = line.Amount || payment.TotalAmt;

        await db.insert(quickbooksPaymentSync).values({
          invoiceId: localInvoiceId,
          quickbooksPaymentId: paymentId,
          quickbooksInvoiceId: qbInvoiceId,
          amount: String(amount),
          paymentDate: payment.TxnDate ? new Date(payment.TxnDate) : new Date(),
          paymentMethod: payment.PaymentMethodRef?.name || null,
          processed: true,
          processedAt: new Date(),
          rawData: payment,
        });

        const [localInvoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, localInvoiceId))
          .limit(1);

        if (localInvoice) {
          const currentAmountPaid = parseFloat(localInvoice.amountPaid || "0");
          const newAmountPaid = currentAmountPaid + amount;
          const totalAmount = parseFloat(localInvoice.total);
          const newBalance = totalAmount - newAmountPaid;
          
          let newStatus = localInvoice.status;
          if (newBalance <= 0) {
            newStatus = "paid";
          } else if (newAmountPaid > 0) {
            newStatus = "sent";
          }

          await db
            .update(invoices)
            .set({
              amountPaid: String(newAmountPaid),
              balance: String(Math.max(0, newBalance)),
              status: newStatus,
              paidDate: newBalance <= 0 ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, localInvoiceId));
        }
      }

      await db
        .update(quickbooksWebhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(quickbooksWebhookEvents.entityId, paymentId));

      resolve();
    });
  });
}

export async function getQuickbooksInvoiceSyncStatus(invoiceId: string): Promise<{ synced: boolean; quickbooksInvoiceId?: string; error?: string }> {
  const [sync] = await db
    .select()
    .from(quickbooksInvoiceSync)
    .where(eq(quickbooksInvoiceSync.invoiceId, invoiceId))
    .limit(1);

  if (!sync) {
    return { synced: false };
  }

  return {
    synced: sync.syncStatus === "synced",
    quickbooksInvoiceId: sync.quickbooksInvoiceId || undefined,
    error: sync.lastError || undefined,
  };
}

export async function getRecentWebhookEvents(limit = 50) {
  return db
    .select()
    .from(quickbooksWebhookEvents)
    .orderBy(quickbooksWebhookEvents.createdAt)
    .limit(limit);
}

declare module 'node-quickbooks' {
  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      oauthToken: string,
      oauthTokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: number | null,
      oauthVersion: string,
      refreshToken?: string | null
    );

    createCustomer(customer: any, callback: (err: any, customer: any) => void): void;
    findCustomers(criteria: any, callback: (err: any, customers: any) => void): void;
    getCustomer(id: string, callback: (err: any, customer: any) => void): void;
    updateCustomer(customer: any, callback: (err: any, customer: any) => void): void;

    createInvoice(invoice: any, callback: (err: any, invoice: any) => void): void;
    findInvoices(criteria: any, callback: (err: any, invoices: any) => void): void;
    getInvoice(id: string, callback: (err: any, invoice: any) => void): void;
    updateInvoice(invoice: any, callback: (err: any, invoice: any) => void): void;
    sendInvoicePdf(id: string, email: string, callback: (err: any, result: any) => void): void;

    createPayment(payment: any, callback: (err: any, payment: any) => void): void;
    findPayments(criteria: any, callback: (err: any, payments: any) => void): void;
    getPayment(id: string, callback: (err: any, payment: any) => void): void;

    findItems(criteria: any, callback: (err: any, items: any) => void): void;
    getItem(id: string, callback: (err: any, item: any) => void): void;
    createItem(item: any, callback: (err: any, item: any) => void): void;
  }

  export = QuickBooks;
}

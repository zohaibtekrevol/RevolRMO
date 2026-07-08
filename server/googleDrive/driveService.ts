// Google Drive storage service.
//
// Integration: connection:conn_google-drive (Replit "Google Drive" connector).
// Credentials are obtained from the Replit connectors credential proxy on every
// request (tokens expire — never cache the client). The connector is granted the
// drive.file scope, so the app can only see/manage files it created itself, which
// is exactly what we want for the per-project folder structure.
import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

export class DriveNotConnectedError extends Error {
  constructor(message = "Google Drive is not connected. Connect a Google account to continue.") {
    super(message);
    this.name = "DriveNotConnectedError";
  }
}

// Names used for the per-project folder structure on Drive.
export const DRIVE_ROOT_FOLDER_NAME = "RevolRMO Documents";
export const DRIVE_SUBFOLDERS = {
  changeRequests: "Change Requests",
  invoices: "Invoices",
  paymentReceipts: "Payment Receipts",
} as const;
export type DriveSubfolderKey = keyof typeof DRIVE_SUBFOLDERS;

export interface ProjectFolderIds {
  projectFolderId: string;
  changeRequestsFolderId: string;
  invoicesFolderId: string;
  paymentReceiptsFolderId: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new DriveNotConnectedError(
      "Connectors hostname not configured; cannot reach Google Drive.",
    );
  }
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) {
    throw new DriveNotConnectedError("No Replit identity token available.");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  );
  if (!response.ok) {
    throw new DriveNotConnectedError(
      `Failed to fetch Google Drive credentials (status ${response.status}).`,
    );
  }
  const data = await response.json();
  const connection = data.items?.[0];
  const settings = connection?.settings ?? {};
  const accessToken: string | undefined =
    settings.access_token ||
    settings.oauth?.credentials?.access_token;
  if (!accessToken) {
    throw new DriveNotConnectedError();
  }
  return accessToken;
}

// Always build a fresh client — access tokens expire and are refreshed by the proxy.
export async function getUncachableDriveClient(): Promise<drive_v3.Drive> {
  const accessToken = await getAccessToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

// Returns true if a Google account is currently connected (credentials resolvable).
export async function isDriveConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

function escapeForQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  const clauses = [
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${escapeForQuery(name)}'`,
    "trashed = false",
    `'${parentId ?? "root"}' in parents`,
  ];
  const res = await drive.files.list({
    q: clauses.join(" and "),
    fields: "files(id, name)",
    pageSize: 1,
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`Failed to create Drive folder: ${name}`);
  return res.data.id;
}

// Idempotent: returns the existing folder id or creates it if missing.
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  return createFolder(drive, name, parentId);
}

// Ensures the app root folder, the project folder, and its three subfolders exist.
// folderName should be unique per project (caller is responsible).
export async function ensureProjectFolders(
  drive: drive_v3.Drive,
  folderName: string,
): Promise<ProjectFolderIds> {
  const rootId = await findOrCreateFolder(drive, DRIVE_ROOT_FOLDER_NAME, null);
  const projectFolderId = await findOrCreateFolder(drive, folderName, rootId);
  const [changeRequestsFolderId, invoicesFolderId, paymentReceiptsFolderId] =
    await Promise.all([
      findOrCreateFolder(drive, DRIVE_SUBFOLDERS.changeRequests, projectFolderId),
      findOrCreateFolder(drive, DRIVE_SUBFOLDERS.invoices, projectFolderId),
      findOrCreateFolder(drive, DRIVE_SUBFOLDERS.paymentReceipts, projectFolderId),
    ]);
  return {
    projectFolderId,
    changeRequestsFolderId,
    invoicesFolderId,
    paymentReceiptsFolderId,
  };
}

export async function uploadFileToFolder(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  mimeType: string,
  content: Buffer,
): Promise<{ id: string; name: string; webViewLink: string | null }> {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: Readable.from(content),
    },
    fields: "id, name, webViewLink",
  });
  if (!res.data.id) throw new Error("Drive upload did not return a file id");
  return {
    id: res.data.id,
    name: res.data.name ?? fileName,
    webViewLink: res.data.webViewLink ?? null,
  };
}

export async function getFileMetadata(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<DriveFile> {
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, size, webViewLink, parents",
  });
  return {
    id: res.data.id!,
    name: res.data.name ?? "file",
    mimeType: res.data.mimeType ?? "application/octet-stream",
    modifiedTime: res.data.modifiedTime ?? undefined,
    size: res.data.size ?? undefined,
    webViewLink: res.data.webViewLink ?? undefined,
    parents: res.data.parents ?? undefined,
  };
}

export async function downloadFileStream(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Readable> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" },
  );
  return res.data as unknown as Readable;
}

// Lists the immediate children of a folder. Set foldersOnly to list subfolders.
export async function listFolderChildren(
  drive: drive_v3.Drive,
  parentId: string,
  opts: { foldersOnly?: boolean } = {},
): Promise<DriveFile[]> {
  const clauses = [`'${parentId}' in parents`, "trashed = false"];
  if (opts.foldersOnly) clauses.push(`mimeType = '${FOLDER_MIME}'`);
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: clauses.join(" and "),
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
      pageSize: 100,
      pageToken,
      orderBy: "folder,name",
      spaces: "drive",
    });
    for (const f of res.data.files ?? []) {
      files.push({
        id: f.id!,
        name: f.name ?? "file",
        mimeType: f.mimeType ?? "application/octet-stream",
        modifiedTime: f.modifiedTime ?? undefined,
        size: f.size ?? undefined,
        webViewLink: f.webViewLink ?? undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

// Resolves (and caches) the Google Drive folder ids for a project. The first time
// a project needs Drive storage we create its folder + subfolders and cache the ids
// in the project_drive_folders table; subsequent calls read from the cache.
import { createHash } from "crypto";
import { pool } from "../db";
import { storage } from "../storage";
import {
  getUncachableDriveClient,
  ensureProjectFolders,
  DriveNotConnectedError,
  type ProjectFolderIds,
  type DriveSubfolderKey,
} from "./driveService";

// Drive folder name for a project. Includes a short id suffix so two projects with
// the same display name never collide on the same Drive folder.
function driveFolderNameForProject(name: string, projectId: string): string {
  const safeName = (name || "Project").trim() || "Project";
  return `${safeName} [${projectId.slice(0, 8)}]`;
}

function cachedToIds(cached: {
  projectFolderId: string;
  changeRequestsFolderId: string;
  invoicesFolderId: string;
  paymentReceiptsFolderId: string;
}): ProjectFolderIds {
  return {
    projectFolderId: cached.projectFolderId,
    changeRequestsFolderId: cached.changeRequestsFolderId,
    invoicesFolderId: cached.invoicesFolderId,
    paymentReceiptsFolderId: cached.paymentReceiptsFolderId,
  };
}

// Single global advisory-lock key for all Drive folder provisioning. We use one
// global lock (not a per-project one) because the shared app root folder
// ("RevolRMO Documents") would otherwise be raced by two *different* projects
// provisioning for the first time at the same time, creating duplicate roots.
// Provisioning only runs on a cache miss (first upload per project), so global
// serialization here is rare and cheap.
const DRIVE_PROVISION_LOCK_KEY = createHash("sha1")
  .update("revolrmo:drive-folder-provision")
  .digest()
  .readBigInt64BE(0)
  .toString();

export async function getOrCreateProjectFolders(
  projectId: string,
): Promise<ProjectFolderIds> {
  const cached = await storage.getProjectDriveFolders(projectId);
  if (cached) return cachedToIds(cached);

  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Serialize provisioning per project with a transaction-scoped advisory lock so
  // concurrent first uploads can't create duplicate Drive folders. The lock is
  // released automatically when the transaction ends (commit or rollback).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      DRIVE_PROVISION_LOCK_KEY,
    ]);

    // Double-check the cache now that we hold the lock — another request may have
    // provisioned the folders while we were waiting.
    const recheck = await storage.getProjectDriveFolders(projectId);
    if (recheck) {
      await client.query("COMMIT");
      return cachedToIds(recheck);
    }

    const drive = await getUncachableDriveClient();
    const ids = await ensureProjectFolders(
      drive,
      driveFolderNameForProject(project.name, projectId),
    );
    await storage.upsertProjectDriveFolders({ projectId, ...ids });
    await client.query("COMMIT");
    return ids;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export function subfolderIdFor(
  ids: ProjectFolderIds,
  subfolder: DriveSubfolderKey,
): string {
  switch (subfolder) {
    case "changeRequests":
      return ids.changeRequestsFolderId;
    case "invoices":
      return ids.invoicesFolderId;
    case "paymentReceipts":
      return ids.paymentReceiptsFolderId;
  }
}

export { DriveNotConnectedError };

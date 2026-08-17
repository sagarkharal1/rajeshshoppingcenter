import os from "node:os";
import path from "node:path";

/**
 * Where backup files are written on local disk.
 *
 * A long-running server keeps them next to the app, so the owner can list and
 * download past backups from the Reports screen.
 *
 * Serverless is different: the filesystem is read-only apart from the OS temp
 * directory, and nothing written there outlives the request. On Vercel this is
 * therefore only a staging area on the way to remote storage — the uploaded
 * copy is the one that matters, and the local list will normally be empty.
 * That makes `BACKUP_SPACES_*` effectively required there rather than optional.
 */
export function getBackupDir(): string {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) return path.resolve(configured);

  // Set on every Vercel deployment, build and runtime alike.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "backups");

  return path.join(process.cwd(), "backups");
}

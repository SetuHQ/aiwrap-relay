import { chmod, copyFile, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AIWRAP_BACKUPS } from "./paths.js";

export async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function writeExecutable(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o755 });
  await chmod(path, 0o755);
}

export async function safeSymlink(target: string, linkPath: string) {
  await mkdir(dirname(linkPath), { recursive: true });
  try {
    const existing = await lstat(linkPath);
    if (existing.isSymbolicLink()) {
      const existingTarget = await readlink(linkPath);
      if (existingTarget === target) return;
      await unlink(linkPath);
    } else {
      throw new Error(`${linkPath} already exists and is not a symlink. Move it before installing aiwrap.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await symlink(target, linkPath);
}

export async function backupIfExists(path: string, label: string): Promise<string | null> {
  if (!(await exists(path))) return null;
  await mkdir(AIWRAP_BACKUPS, { recursive: true });
  const backupPath = `${AIWRAP_BACKUPS}/${label}-${Date.now()}`;
  await copyFile(path, backupPath);
  return backupPath;
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

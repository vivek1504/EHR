import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { config } from "../config/index.js";

export async function uploadDocument(
  documentId: string,
  text: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const storageKey = `documents/${documentId}.txt`;

  if (config.GCS_EMULATOR) {
    const fullPath = join(config.STORAGE_PATH, `${documentId}.txt`);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, text, "utf-8");
    return storageKey;
  }
  throw new Error(
    "GCS upload not implemented — set GCS_EMULATOR=true for local dev",
  );
}

export async function downloadDocument(storageKey: string): Promise<string> {
  if (config.GCS_EMULATOR) {
    const filename = storageKey.replace("documents/", "");
    const fullPath = join(config.STORAGE_PATH, filename);

    if (!existsSync(fullPath)) {
      throw new Error(`Document not found in local storage: ${fullPath}`);
    }
    return readFileSync(fullPath, "utf-8");
  }
  throw new Error(
    "GCS download not implemented — set GCS_EMULATOR=true for local dev",
  );
}

export async function deleteDocument(storageKey: string): Promise<void> {
  if (config.GCS_EMULATOR) {
    const filename = storageKey.replace("documents/", "");
    const fullPath = join(config.STORAGE_PATH, filename);

    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
    return;
  }
  throw new Error(
    "GCS delete not implemented — set GCS_EMULATOR=true for local dev",
  );
}

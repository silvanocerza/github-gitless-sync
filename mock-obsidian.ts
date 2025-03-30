import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  promises as fs,
} from "fs";
import * as path from "path";

// Mock Obsidian's Vault class
export class Vault {
  configDir: string;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.configDir = path.join(this.rootPath, ".obsidian");

    // Ensure vault directory exists
    if (!existsSync(this.rootPath)) {
      mkdirSync(this.rootPath, { recursive: true });
    }

    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
  }

  getRoot() {
    return { path: this.rootPath };
  }

  get adapter() {
    return {
      read: async (filePath: string) => {
        const fullPath = path.join(this.rootPath, filePath);
        return readFileSync(fullPath, "utf8");
      },

      write: async (filePath: string, data: string) => {
        const fullPath = path.join(this.rootPath, filePath);
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, data);
      },

      readBinary: async (filePath: string) => {
        const fullPath = path.join(this.rootPath, filePath);
        return readFileSync(fullPath);
      },

      writeBinary: async (filePath: string, data: ArrayBuffer) => {
        const fullPath = path.join(this.rootPath, filePath);
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, Buffer.from(data));
      },

      exists: async (filePath: string) => {
        const fullPath = path.join(this.rootPath, filePath);
        return existsSync(fullPath);
      },

      mkdir: async (dirPath: string) => {
        const fullPath = path.join(this.rootPath, dirPath);
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true });
        }
      },

      remove: async (filePath: string) => {
        const fullPath = path.join(this.rootPath, filePath);
        if (existsSync(fullPath)) {
          await fs.unlink(fullPath);
        }
      },

      list: async (dirPath: string) => {
        const fullPath = path.join(this.rootPath, dirPath);
        if (!existsSync(fullPath)) {
          return { files: [], folders: [] };
        }

        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const files = entries
          .filter((entry) => entry.isFile())
          .map((entry) => path.join(dirPath, entry.name));

        const folders = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(dirPath, entry.name));

        return { files, folders };
      },
    };
  }
}

// Mock Notice
export class Notice {
  constructor(message: string, timeout?: number) {
    console.log(`NOTICE: ${message}`);
  }

  hide() {
    // Do nothing in mock
  }
}

interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  contentType?: string;
  body?: string | ArrayBuffer;
  throw?: boolean;
}

export async function requestUrl(options: RequestUrlParam) {
  try {
    const response = await fetch(options.url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
    });

    const arrayBuffer = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(arrayBuffer);
    let json = null;

    json = JSON.parse(text);

    // Convert to expected Obsidian response format
    const obsidianResponse = {
      status: response.status,
      json: () => Promise.resolve(json),
    };

    if (!response.ok) {
      const err = new Error(`Request failed with status ${response.status}`);
      err.response = obsidianResponse;
      throw err;
    }

    return obsidianResponse;
  } catch (error) {
    if (error.response) {
      // Error already formatted with Obsidian response
      throw error;
    }

    // Network error or other fetch error
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Mock utility functions
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Buffer.from(base64, "base64");
}

// Mock Event reference
export type EventRef = string;

// Re-export the fileTypeFromBuffer function
export { fileTypeFromBuffer } from "file-type";

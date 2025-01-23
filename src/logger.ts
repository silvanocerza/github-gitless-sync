import { Vault, normalizePath } from "obsidian";

const LOG_FILE_NAME = "github-sync.log" as const;

export default class Logger {
  private enabled: boolean;
  private logFile: string;

  constructor(private vault: Vault) {
    this.logFile = normalizePath(`${vault.configDir}/${LOG_FILE_NAME}`);
    this.enabled = true;
  }

  private async write(
    level: string,
    message: string,
    data?: any,
  ): Promise<void> {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      additional_data: data,
    };

    await this.vault.adapter.append(
      this.logFile,
      JSON.stringify(logEntry) + "\n",
    );
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  async info(message: string, data?: any): Promise<void> {
    await this.write("INFO", message, data);
  }

  async warn(message: string, data?: any): Promise<void> {
    await this.write("WARN", message, data);
  }

  async error(message: string, data?: any): Promise<void> {
    await this.write("ERROR", message, data);
  }
}

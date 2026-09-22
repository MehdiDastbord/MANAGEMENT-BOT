export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class BotLogger {
  private static timestamp(): string {
    return new Date().toISOString();
  }

  static info(message: string, meta?: Record<string, unknown>) {
    console.log(`[INFO] [${this.timestamp()}] ${message}`, meta ?? '');
  }

  static warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[WARN] [${this.timestamp()}] ${message}`, meta ?? '');
  }

  static error(message: string, error?: unknown) {
    console.error(`[ERROR] [${this.timestamp()}] ${message}`, error ?? '');
  }

  static debug(message: string, meta?: Record<string, unknown>) {
    console.log(`[DEBUG] [${this.timestamp()}] ${message}`, meta ?? '');
  }
}

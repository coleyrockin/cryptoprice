import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export function createRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `req_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  logEvent("error", event, {
    ...fields,
    error: serializeError(error),
  });
}

export function createStructuredLogger(scope: string, requestId: string): Pick<Console, "info" | "warn" | "error"> {
  return {
    info: (message?: unknown, ...args: unknown[]) => {
      logEvent("info", `${scope}.info`, {
        requestId,
        message: String(message ?? ""),
        args,
      });
    },
    warn: (message?: unknown, ...args: unknown[]) => {
      logEvent("warn", `${scope}.warn`, {
        requestId,
        message: String(message ?? ""),
        args,
      });
    },
    error: (message?: unknown, ...args: unknown[]) => {
      logEvent("error", `${scope}.error`, {
        requestId,
        message: String(message ?? ""),
        args,
      });
    },
  };
}

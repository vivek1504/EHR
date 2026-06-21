type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(
  severity: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    write("INFO", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("WARN", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("ERROR", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("DEBUG", message, meta),
};

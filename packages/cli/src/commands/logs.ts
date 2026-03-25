interface LogEntry {
  level: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export const logsCommand = {
  formatLog(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${time} [${level}] ${entry.message}${data}`;
  },
};

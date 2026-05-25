export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

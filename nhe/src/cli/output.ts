const isTty = Boolean(process.stdout.isTTY);

function wrap(code: number, s: string): string {
  return isTty ? `\x1b[${code}m${s}\x1b[0m` : s;
}

export const fmt = {
  user: (s: string): string => wrap(36, s),       // cyan
  assistant: (s: string): string => wrap(32, s),  // green
  warn: (s: string): string => wrap(33, s),       // yellow
  error: (s: string): string => wrap(31, s),      // red
  dim: (s: string): string => wrap(2, s),
  bold: (s: string): string => wrap(1, s),
};

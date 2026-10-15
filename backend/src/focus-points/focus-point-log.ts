import { Logger } from '@nestjs/common';

// Feature 20: one structured line per domain event ("focus_point.window_closed teamId=3 ..."), so
// the process can be followed from the server logs even when a client blocks analytics. By design
// it NEVER carries who rated (or who proposed): ratings and proposals are anonymous to the team, and
// the logs must not become a second place where that link exists. Only managers' ids appear.
export function logFocusEvent(logger: Logger, event: string, data: Record<string, string | number | boolean | null | undefined>) {
  const fields = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  logger.log(`focus_point.${event}${fields ? ` ${fields}` : ''}`);
}

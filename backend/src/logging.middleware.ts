import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// BUG-41: never log the query string (OAuth `code`/`state`/`ticket` live there) or the invite
// token, which is a path segment of the public `GET /invites/:token` + `POST /invites/:token/...`
// routes. Only the root-level `/invites/<token>` form is a token; `/teams/5/invites/12` carries a
// numeric id and is left alone.
export function sanitizeUrlForLog(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.replace(/^\/+invites\/[^/]+/i, '/invites/[redacted]');
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method } = request;
    const loggedPath = sanitizeUrlForLog(request.originalUrl);
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;
      const duration = Date.now() - startTime;

      this.logger.log(
        `${method} ${loggedPath} ${statusCode} ${contentLength} - ${duration}ms - ${ip} ${userAgent}`,
      );
    });

    next();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHello(): Promise<string> {
    try {
      const dbCheck = await this.prisma.$queryRaw<{ result: number }[]>`SELECT 1 as result`;
      return `Hello World! Database connected successfully: ${JSON.stringify(dbCheck)}`;
    } catch (err: any) {
      // BUG-42: this endpoint is public — log the real error, never return the raw DB message.
      this.logger.error('Database health check failed', err instanceof Error ? err.stack : err);
      return 'Hello World! Database connection failed';
    }
  }
}

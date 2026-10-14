import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { purgeExpiredSoftDeleted } from './soft-delete-purge';

/** Runs the 30-day purge (feature 14) once when the server starts. Never blocks or fails startup. */
@Injectable()
export class SoftDeletePurgeBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SoftDeletePurgeBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // E2E / unit runs build the full AppModule many times; the purge is only meaningful (and safe to
    // skip) there — tests that need it call `purgeExpiredSoftDeleted` directly.
    if (process.env.NODE_ENV === 'test') return;
    try {
      const { teams, sprints } = await purgeExpiredSoftDeleted(this.prisma);
      if (teams || sprints) this.logger.log(`Purged ${teams} team(s) and ${sprints} sprint(s) past the 30-day restore window`);
    } catch (err) {
      this.logger.warn('Soft-delete purge failed on startup', err instanceof Error ? err.stack : err);
    }
  }
}

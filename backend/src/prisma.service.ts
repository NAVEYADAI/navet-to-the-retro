import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  // Without this, `app.close()` leaves the connection pool open — every e2e spec file
  // leaked one, which exhausted Postgres' max_connections ("too many clients already").
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

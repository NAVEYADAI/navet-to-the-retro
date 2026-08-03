import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHello(): Promise<string> {
    try {
      const dbCheck = await this.prisma.$queryRaw<{ result: number }[]>`SELECT 1 as result`;
      return `Hello World! Database connected successfully: ${JSON.stringify(dbCheck)}`;
    } catch (err: any) {
      return `Hello World! Database connection failed: ${err.message}`;
    }
  }
}

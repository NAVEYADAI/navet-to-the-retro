import { Module } from '@nestjs/common';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ActionItemsController],
  providers: [ActionItemsService, PrismaService],
  exports: [ActionItemsService]
})
export class ActionItemsModule {}

import { Module } from '@nestjs/common';
import { FocusPointsController } from './focus-points.controller';
import { FocusPointsService } from './focus-points.service';
import { FocusPointRatingService } from './focus-point-rating.service';
import { FocusPointTasksService } from './focus-point-tasks.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FocusPointsController],
  providers: [FocusPointsService, FocusPointRatingService, FocusPointTasksService, PrismaService]
})
export class FocusPointsModule {}

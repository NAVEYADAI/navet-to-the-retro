import { Module } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { SprintsController } from './sprints.controller';
import { PrismaService } from '../prisma.service';
import { AuthService } from '../auth/auth.service';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';

@Module({
  imports: [GoogleCalendarModule],
  controllers: [SprintsController],
  providers: [SprintsService, PrismaService, AuthService],
  exports: [SprintsService]
})
export class SprintsModule {}

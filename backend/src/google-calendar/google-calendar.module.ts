import { Module } from '@nestjs/common';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, PrismaService],
  exports: [GoogleCalendarService]
})
export class GoogleCalendarModule {}

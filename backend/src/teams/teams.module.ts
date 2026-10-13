import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamLogoService } from './team-logo.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../email/email.service';
import { InvitesModule } from '../invites/invites.module';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';

@Module({
  imports: [AuthModule, InvitesModule, GoogleCalendarModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamLogoService, PrismaService, EmailService],
  exports: [TeamsService]
})
export class TeamsModule {}

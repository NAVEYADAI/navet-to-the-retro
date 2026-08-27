import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../email/email.service';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [AuthModule, InvitesModule],
  controllers: [TeamsController],
  providers: [TeamsService, PrismaService, EmailService],
  exports: [TeamsService]
})
export class TeamsModule {}

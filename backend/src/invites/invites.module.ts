import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../email/email.service';

@Module({
  imports: [AuthModule],
  controllers: [InvitesController],
  providers: [InvitesService, PrismaService, EmailService],
  exports: [InvitesService]
})
export class InvitesModule {}

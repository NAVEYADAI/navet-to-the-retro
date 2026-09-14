import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleLoginService } from './google-login.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleLoginService, PrismaService],
  exports: [AuthService]
})
export class AuthModule {}

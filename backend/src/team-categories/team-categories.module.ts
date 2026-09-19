import { Module } from '@nestjs/common';
import { TeamCategoriesController } from './team-categories.controller';
import { TeamCategoriesService } from './team-categories.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TeamCategoriesController],
  providers: [TeamCategoriesService, PrismaService],
  exports: [TeamCategoriesService]
})
export class TeamCategoriesModule {}

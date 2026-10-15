import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { LoggingMiddleware } from './logging.middleware';
import { TeamsModule } from './teams/teams.module';
import { CommentsModule } from './comments/comments.module';
import { SprintsModule } from './sprints/sprints.module';
import { InvitesModule } from './invites/invites.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { TeamCategoriesModule } from './team-categories/team-categories.module';
import { FocusPointsModule } from './focus-points/focus-points.module';
import { TelegramModule } from './telegram/telegram.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SoftDeletePurgeBootstrap } from './common/soft-delete-purge.bootstrap';

@Module({
  imports: [AuthModule, TeamsModule, CommentsModule, SprintsModule, InvitesModule, GoogleCalendarModule, TeamCategoriesModule, FocusPointsModule, TelegramModule, OnboardingModule],
  controllers: [AppController],
  providers: [AppService, PrismaService, SoftDeletePurgeBootstrap],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');
  }
}

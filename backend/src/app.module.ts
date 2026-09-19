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

@Module({
  imports: [AuthModule, TeamsModule, CommentsModule, SprintsModule, InvitesModule, GoogleCalendarModule, TeamCategoriesModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');
  }
}

import { Controller, Post, Get, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthService } from '../auth/auth.service';
import { CreateCommentDto } from './dto/comments.dto';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateCommentDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.create(dto, user.id);
  }

  @Get('team/:teamId')
  async getCommentsForTeam(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.getCommentsForTeam(teamId, user.id);
  }
}

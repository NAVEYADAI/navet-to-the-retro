import { Controller, Post, Get, Patch, Body, Param, Headers } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthService } from '../auth/auth.service';
import { IntIdPipe } from '../common/validation';
import { CreateCommentDto, UpdateHighlightDto } from './dto/comments.dto';

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly authService: AuthService
  ) {}

  @Post('sprints/:sprintId/comments')
  async create(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number,
    @Body() dto: CreateCommentDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.create(sprintId, dto, user.id);
  }

  @Get('sprints/:sprintId/comments')
  async getCommentsForSprint(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.getCommentsForSprint(sprintId, user.id);
  }

  @Patch('comments/:commentId/highlight')
  async setHighlighted(
    @Headers('authorization') authHeader: string,
    @Param('commentId', IntIdPipe) commentId: number,
    @Body() dto: UpdateHighlightDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.setHighlighted(commentId, dto, user.id);
  }
}

import { Controller, Post, Get, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthService } from '../auth/auth.service';
import { CreateCommentDto } from './dto/comments.dto';

@Controller('sprints/:sprintId/comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body() dto: CreateCommentDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.create(sprintId, dto, user.id);
  }

  @Get()
  async getCommentsForSprint(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', ParseIntPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.getCommentsForSprint(sprintId, user.id);
  }
}

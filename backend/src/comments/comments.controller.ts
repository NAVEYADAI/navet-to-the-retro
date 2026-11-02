import { Controller, Post, Get, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AuthService } from '../auth/auth.service';
import { IntIdPipe } from '../common/validation';
import { CreateCommentDto, UpdateCommentDto, UpdateHighlightDto, CreateWriteExtensionDto } from './dto/comments.dto';
import { SprintWriteExtensionsService } from './sprint-write-extensions.service';

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly extensionsService: SprintWriteExtensionsService,
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

  // Feature 13 (product-backlog/13-comment-edit-delete.md): edit / soft-delete a comment.
  @Patch('comments/:commentId')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('commentId', IntIdPipe) commentId: number,
    @Body() dto: UpdateCommentDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.update(commentId, dto, user.id);
  }

  @Delete('comments/:commentId')
  async remove(
    @Headers('authorization') authHeader: string,
    @Param('commentId', IntIdPipe) commentId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.remove(commentId, user.id);
  }

  // Admin only. (Declared as a static path next to the `:sprintId/comments` routes — no conflict.)
  @Get('sprints/:sprintId/comments/deleted')
  async getDeletedComments(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.commentsService.getDeletedComments(sprintId, user.id);
  }

  // Write window: what the requester may do on this sprint + the admin's per-member extensions.
  @Get('sprints/:sprintId/write-access')
  async getWriteAccess(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.extensionsService.getAccess(sprintId, user.id);
  }

  @Get('sprints/:sprintId/write-extensions')
  async listWriteExtensions(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.extensionsService.list(sprintId, user.id);
  }

  @Post('sprints/:sprintId/write-extensions')
  async grantWriteExtension(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number,
    @Body() dto: CreateWriteExtensionDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.extensionsService.grant(sprintId, dto, user.id);
  }

  @Delete('sprints/:sprintId/write-extensions/:extensionId')
  async revokeWriteExtension(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number,
    @Param('extensionId', IntIdPipe) extensionId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.extensionsService.revoke(sprintId, extensionId, user.id);
  }
}

import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { IntIdPipe } from '../common/validation';
import { AuthService } from '../auth/auth.service';
import { FocusPointsService } from './focus-points.service';
import { FocusPointRatingService } from './focus-point-rating.service';
import { FocusPointTasksService } from './focus-point-tasks.service';
import {
  CreateFocusPointDto, UpdateFocusPointDto, MergeFocusPointDto, RateFocusPointDto,
  UpdateFocusPointSettingsDto, CreateFocusPointTaskDto, UpdateFocusPointTaskDto
} from './dto/focus-points.dto';

@Controller()
export class FocusPointsController {
  constructor(
    private readonly points: FocusPointsService,
    private readonly rating: FocusPointRatingService,
    private readonly tasks: FocusPointTasksService,
    private readonly auth: AuthService
  ) {}

  // ---- team member ----

  @Post('comments/:commentId/propose')
  async propose(@Headers('authorization') h: string, @Param('commentId', IntIdPipe) commentId: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.propose(commentId, user.id);
  }

  @Get('sprints/:sprintId/proposed-comments')
  async myProposed(@Headers('authorization') h: string, @Param('sprintId', IntIdPipe) sprintId: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.myProposedCommentIds(sprintId, user.id);
  }

  @Get('sprints/:sprintId/focus-points')
  async sprintView(@Headers('authorization') h: string, @Param('sprintId', IntIdPipe) sprintId: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.sprintView(sprintId, user.id);
  }

  @Put('focus-points/:id/rating')
  async rate(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number, @Body() dto: RateFocusPointDto) {
    const user = await this.auth.validateToken(h);
    return this.rating.rate(id, dto, user.id);
  }

  @Get('me/focus-point-tasks')
  async myTasks(@Headers('authorization') h: string, @Query('status') status?: string) {
    const user = await this.auth.validateToken(h);
    return this.tasks.listMine(user.id, status);
  }

  // ---- management (admin / team leader) ----

  @Get('teams/:teamId/focus-points')
  async list(@Headers('authorization') h: string, @Param('teamId', IntIdPipe) teamId: number, @Query('includeMerged') includeMerged?: string) {
    const user = await this.auth.validateToken(h);
    return this.points.list(teamId, user.id, includeMerged === 'true');
  }

  @Get('teams/:teamId/focus-point-proposals')
  async proposals(@Headers('authorization') h: string, @Param('teamId', IntIdPipe) teamId: number) {
    const user = await this.auth.validateToken(h);
    return this.points.listProposals(teamId, user.id);
  }

  @Delete('comments/:commentId/proposals')
  async dismiss(@Headers('authorization') h: string, @Param('commentId', IntIdPipe) commentId: number) {
    const user = await this.auth.validateToken(h);
    return this.points.dismissProposals(commentId, user.id);
  }

  @Post('teams/:teamId/focus-points')
  async create(@Headers('authorization') h: string, @Param('teamId', IntIdPipe) teamId: number, @Body() dto: CreateFocusPointDto) {
    const user = await this.auth.validateToken(h);
    return this.points.create(teamId, dto, user.id);
  }

  @Patch('teams/:teamId/focus-point-settings')
  async settings(@Headers('authorization') h: string, @Param('teamId', IntIdPipe) teamId: number, @Body() dto: UpdateFocusPointSettingsDto) {
    const user = await this.auth.validateToken(h);
    return this.points.updateSettings(teamId, dto, user.id);
  }

  @Patch('focus-points/:id')
  async update(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number, @Body() dto: UpdateFocusPointDto) {
    const user = await this.auth.validateToken(h);
    return this.points.update(id, dto, user.id);
  }

  @Get('focus-points/:id/history')
  async history(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number) {
    const user = await this.auth.validateToken(h);
    return this.points.history(id, user.id);
  }

  @Post('focus-points/:id/merge')
  async merge(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number, @Body() dto: MergeFocusPointDto) {
    const user = await this.auth.validateToken(h);
    return this.points.merge(id, dto, user.id);
  }

  @Put('sprints/:sprintId/focus-points/:id/select')
  async select(@Headers('authorization') h: string, @Param('sprintId', IntIdPipe) sprintId: number, @Param('id', IntIdPipe) id: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.select(sprintId, id, user.id);
  }

  @Delete('sprints/:sprintId/focus-points/:id/select')
  async deselect(@Headers('authorization') h: string, @Param('sprintId', IntIdPipe) sprintId: number, @Param('id', IntIdPipe) id: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.deselect(sprintId, id, user.id);
  }

  @Post('sprints/:sprintId/rating-close')
  async closeWindow(@Headers('authorization') h: string, @Param('sprintId', IntIdPipe) sprintId: number) {
    const user = await this.auth.validateToken(h);
    return this.rating.closeWindow(sprintId, user.id);
  }

  // ---- tasks under a point ----

  @Post('focus-points/:id/tasks')
  async createTask(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number, @Body() dto: CreateFocusPointTaskDto) {
    const user = await this.auth.validateToken(h);
    return this.tasks.create(id, dto, user.id);
  }

  @Patch('focus-point-tasks/:id')
  async updateTask(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number, @Body() dto: UpdateFocusPointTaskDto) {
    const user = await this.auth.validateToken(h);
    return this.tasks.update(id, dto, user.id);
  }

  @Delete('focus-point-tasks/:id')
  async removeTask(@Headers('authorization') h: string, @Param('id', IntIdPipe) id: number) {
    const user = await this.auth.validateToken(h);
    return this.tasks.remove(id, user.id);
  }
}

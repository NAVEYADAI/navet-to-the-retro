import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { IntIdPipe } from '../common/validation';
import { TeamCategoriesService } from './team-categories.service';
import { AuthService } from '../auth/auth.service';
import { CreateTeamCategoryDto, UpdateTeamCategoryDto } from './dto/team-categories.dto';

@Controller()
export class TeamCategoriesController {
  constructor(
    private readonly teamCategoriesService: TeamCategoriesService,
    private readonly authService: AuthService
  ) {}

  @Get('teams/:teamId/categories')
  async listCategories(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Query('enabledOnly') enabledOnly?: string,
    // Comma-separated sprint ids, e.g. "?sprintIds=4,5,9" — the settings panel's per-sprint
    // checkbox filter on each category's usage count. Absent/empty -> no filter (all sprints).
    @Query('sprintIds') sprintIdsParam?: string
  ) {
    const user = await this.authService.validateToken(authHeader);
    // BUG-15: every non-empty token must be a valid Int32 id (else 400, not a Prisma overflow 500).
    const idPipe = new IntIdPipe();
    const sprintIds = sprintIdsParam
      ? sprintIdsParam.split(',').map(s => s.trim()).filter(s => s !== '').map(s => idPipe.transform(s))
      : undefined;
    return this.teamCategoriesService.listCategories(teamId, user.id, enabledOnly === 'true', sprintIds);
  }

  @Post('teams/:teamId/categories')
  async createCategory(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Body() dto: CreateTeamCategoryDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamCategoriesService.createCategory(teamId, dto, user.id);
  }

  @Patch('teams/:teamId/categories/:categoryId')
  async updateCategory(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Param('categoryId', IntIdPipe) categoryId: number,
    @Body() dto: UpdateTeamCategoryDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamCategoriesService.updateCategory(teamId, categoryId, dto, user.id);
  }
}

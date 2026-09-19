import { Controller, Get, Post, Patch, Body, Param, Query, Headers, ParseIntPipe } from '@nestjs/common';
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
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('enabledOnly') enabledOnly?: string,
    // Comma-separated sprint ids, e.g. "?sprintIds=4,5,9" — the settings panel's per-sprint
    // checkbox filter on each category's usage count. Absent/empty -> no filter (all sprints).
    @Query('sprintIds') sprintIdsParam?: string
  ) {
    const user = await this.authService.validateToken(authHeader);
    const sprintIds = sprintIdsParam
      ? sprintIdsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
      : undefined;
    return this.teamCategoriesService.listCategories(teamId, user.id, enabledOnly === 'true', sprintIds);
  }

  @Post('teams/:teamId/categories')
  async createCategory(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateTeamCategoryDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamCategoriesService.createCategory(teamId, dto, user.id);
  }

  @Patch('teams/:teamId/categories/:categoryId')
  async updateCategory(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateTeamCategoryDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamCategoriesService.updateCategory(teamId, categoryId, dto, user.id);
  }
}

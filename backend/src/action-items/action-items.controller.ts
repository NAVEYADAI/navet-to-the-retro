import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { IntIdPipe } from '../common/validation';
import { ActionItemsService } from './action-items.service';
import { AuthService } from '../auth/auth.service';
import { CreateActionItemDto, UpdateActionItemDto } from './dto/action-items.dto';

@Controller()
export class ActionItemsController {
  constructor(
    private readonly actionItemsService: ActionItemsService,
    private readonly authService: AuthService
  ) {}

  @Get('teams/:teamId/action-items')
  async listForTeam(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Query('status') status?: string
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.actionItemsService.listForTeam(teamId, user.id, status);
  }

  @Get('me/action-items')
  async listMine(
    @Headers('authorization') authHeader: string,
    @Query('status') status?: string
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.actionItemsService.listMine(user.id, status);
  }

  @Post('sprints/:sprintId/action-items')
  async create(
    @Headers('authorization') authHeader: string,
    @Param('sprintId', IntIdPipe) sprintId: number,
    @Body() dto: CreateActionItemDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.actionItemsService.create(sprintId, dto, user.id);
  }

  @Patch('action-items/:id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) id: number,
    @Body() dto: UpdateActionItemDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.actionItemsService.update(id, dto, user.id);
  }

  @Delete('action-items/:id')
  async remove(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) id: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.actionItemsService.remove(id, user.id);
  }
}

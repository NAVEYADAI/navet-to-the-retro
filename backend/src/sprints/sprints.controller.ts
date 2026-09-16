import { Controller, Post, Get, Patch, Body, Param, Query, Headers, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SprintsService } from './sprints.service';
import { AuthService } from '../auth/auth.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprints.dto';

@Controller('teams/:teamId/sprints')
export class SprintsController {
  constructor(
    private readonly sprintsService: SprintsService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateSprintDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.sprintsService.create(teamId, dto, user.id);
  }

  @Get()
  async findAll(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.sprintsService.findAll(teamId, user.id);
  }

  @Patch(':sprintId')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Body() dto: UpdateSprintDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.sprintsService.update(teamId, sprintId, dto, user.id);
  }

  @Get(':sprintId/length-history')
  async getLengthHistory(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('sprintId', ParseIntPipe) sprintId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.sprintsService.getLengthHistory(teamId, sprintId, user.id);
  }

  @Get(':sprintId/summary/export')
  async exportSummary(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('sprintId', ParseIntPipe) sprintId: number,
    @Query('template') template: string | undefined,
    @Res() res: Response
  ) {
    const user = await this.authService.validateToken(authHeader);
    const { buffer, fileName } = await this.sprintsService.exportSummaryPptx(teamId, sprintId, user.id, template);
    // @Res() without passthrough opts us out of Nest's default JSON serialization, which would
    // otherwise wrap this Buffer as `{"type":"Buffer","data":[...]}` instead of sending raw bytes.
    // `filename*` (RFC 5987) carries the real Hebrew name; the plain `filename` is an ASCII
    // fallback for any client that doesn't understand the extended form.
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="sprint-summary.pptx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    });
    res.send(buffer);
  }
}

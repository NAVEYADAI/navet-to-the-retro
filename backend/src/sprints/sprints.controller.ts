import { Controller, Post, Get, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { AuthService } from '../auth/auth.service';
import { CreateSprintDto } from './dto/sprints.dto';

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
}

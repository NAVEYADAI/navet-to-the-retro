import { Controller, Post, Get, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthService } from '../auth/auth.service';
import { CreateTeamDto, AddMemberDto } from './dto/teams.dto';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateTeamDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.create(dto, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) teamId: number,
    @Body() dto: AddMemberDto
  ) {
    await this.authService.validateToken(authHeader);
    return this.teamsService.addMember(teamId, dto);
  }

  @Get('user/me')
  async getMyTeams(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.getTeamsForUser(user.id);
  }

  @Get(':id/members')
  async getTeamMembers(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) teamId: number
  ) {
    await this.authService.validateToken(authHeader);
    return this.teamsService.getTeamMembers(teamId);
  }
}

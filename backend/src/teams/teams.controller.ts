import { Controller, Post, Get, Patch, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthService } from '../auth/auth.service';
import { CreateTeamDto, AddMemberDto, UpdateMemberDto } from './dto/teams.dto';

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
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.addMember(teamId, dto, user.id);
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

  @Patch(':teamId/members/:memberId')
  async updateMember(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.updateMember(teamId, memberId, dto, user.id);
  }
}

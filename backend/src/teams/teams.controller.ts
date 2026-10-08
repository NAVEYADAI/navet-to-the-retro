import { Controller, Post, Get, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthService } from '../auth/auth.service';
import { IntIdPipe } from '../common/validation';
import { CreateTeamDto, AddMemberDto, UpdateMemberDto, CreatePhantomMemberDto } from './dto/teams.dto';

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

  @Get('allowed-approvers')
  async getAllowedApprovers(@Headers('authorization') authHeader: string) {
    await this.authService.validateToken(authHeader);
    return this.teamsService.getAllowedApprovers();
  }

  @Post(':id/approve')
  async approve(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.approveTeam(teamId, user.id);
  }

  @Post(':id/decline')
  async decline(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.declineTeam(teamId, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) teamId: number,
    @Body() dto: AddMemberDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.addMember(teamId, dto, user.id);
  }

  @Post(':teamId/members/:memberId/accept')
  async acceptMemberInvite(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Param('memberId', IntIdPipe) memberId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.acceptMemberInvite(teamId, memberId, user.id);
  }

  @Post(':teamId/members/:memberId/decline')
  async declineMemberInvite(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Param('memberId', IntIdPipe) memberId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.declineMemberInvite(teamId, memberId, user.id);
  }

  @Get('user/me')
  async getMyTeams(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.getTeamsForUser(user.id);
  }

  @Get(':id/members')
  async getTeamMembers(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.getTeamMembers(teamId, user.id);
  }

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1).
  @Post(':teamId/phantom-members')
  async createPhantomMember(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Body() dto: CreatePhantomMemberDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.createPhantomMember(teamId, dto, user.id);
  }

  @Patch(':teamId/members/:memberId')
  async updateMember(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Param('memberId', IntIdPipe) memberId: number,
    @Body() dto: UpdateMemberDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.updateMember(teamId, memberId, dto, user.id);
  }

  @Delete(':teamId/members/:memberId')
  async removeMember(
    @Headers('authorization') authHeader: string,
    @Param('teamId', IntIdPipe) teamId: number,
    @Param('memberId', IntIdPipe) memberId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.removeMember(teamId, memberId, user.id);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id', IntIdPipe) teamId: number,
    @Body() dto: { name?: string; mainOffice?: string }
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.teamsService.updateTeam(teamId, dto, user.id);
  }
}

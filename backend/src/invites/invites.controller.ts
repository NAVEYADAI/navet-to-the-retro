import { Controller, Post, Get, Patch, Body, Param, Headers, ParseIntPipe } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { AuthService } from '../auth/auth.service';
import { CreateInviteDto, CreatePhantomConversionInviteDto, ConsumePhantomConversionInviteDto } from './dto/invites.dto';

@Controller()
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly authService: AuthService
  ) {}

  @Get('invites/:token')
  async getInvite(@Param('token') token: string) {
    return this.invitesService.getInvite(token);
  }

  @Post('invites/:token/consume')
  async consumeInvite(
    @Headers('authorization') authHeader: string,
    @Param('token') token: string
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.invitesService.consumeInvite(token, user);
  }

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #3): no
  // `Authorization` header — there is no logged-in user yet, the phantom's own User row is the
  // one being filled in.
  @Post('invites/:token/consume-phantom-conversion')
  async consumePhantomConversionInvite(
    @Param('token') token: string,
    @Body() dto: ConsumePhantomConversionInviteDto
  ) {
    return this.invitesService.consumePhantomConversionInvite(token, dto);
  }

  @Post('teams/:teamId/invites')
  async createInvite(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateInviteDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.invitesService.createInvite(teamId, dto, user.id);
  }

  @Get('teams/:teamId/invites')
  async listInvites(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.invitesService.listInvites(teamId, user.id);
  }

  @Patch('teams/:teamId/invites/:inviteId')
  async revokeInvite(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.invitesService.revokeInvite(teamId, inviteId, user.id);
  }

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1).
  @Post('teams/:teamId/phantom-members/:memberId/conversion-invite')
  async createPhantomConversionInvite(
    @Headers('authorization') authHeader: string,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: CreatePhantomConversionInviteDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.invitesService.createPhantomConversionInvite(teamId, memberId, dto, user.id);
  }
}

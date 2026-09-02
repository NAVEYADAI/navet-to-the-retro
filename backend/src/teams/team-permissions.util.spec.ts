import { ForbiddenException } from '@nestjs/common';
import { assertCanManageTeamContent } from './team-permissions.util';

describe('assertCanManageTeamContent', () => {
  const teamId = 1;
  const requesterId = 42;

  const mockPrismaService = {
    teamMember: {
      findUnique: jest.fn(),
    },
  } as any;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws ForbiddenException when the requester has no membership at all', async () => {
    mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

    await expect(assertCanManageTeamContent(mockPrismaService, teamId, requesterId)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for a plain member (not admin, not team leader)', async () => {
    mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: false, role: 'DEVELOPER' });

    await expect(assertCanManageTeamContent(mockPrismaService, teamId, requesterId)).rejects.toThrow(ForbiddenException);
  });

  it('resolves for a team admin, regardless of role', async () => {
    mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: true, role: 'DEVELOPER' });

    await expect(assertCanManageTeamContent(mockPrismaService, teamId, requesterId)).resolves.toBeUndefined();
  });

  it('resolves for a TEAM_LEADER even if not an admin', async () => {
    mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: false, role: 'TEAM_LEADER' });

    await expect(assertCanManageTeamContent(mockPrismaService, teamId, requesterId)).resolves.toBeUndefined();
  });

  it('looks up membership by the exact requester/team pair passed in', async () => {
    mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: true, role: 'DEVELOPER' });

    await assertCanManageTeamContent(mockPrismaService, teamId, requesterId);

    expect(mockPrismaService.teamMember.findUnique).toHaveBeenCalledWith({
      where: { userId_teamId: { userId: requesterId, teamId } },
    });
  });
});

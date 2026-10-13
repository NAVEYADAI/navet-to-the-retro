import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamLogoService } from './team-logo.service';
import { AuthService } from '../auth/auth.service';

describe('TeamsController', () => {
  let controller: TeamsController;

  const mockUser = { id: 1, username: 'testuser' };
  const authHeader = 'Bearer dummytoken';

  const mockTeamsService = {
    create: jest.fn(),
    getAllowedApprovers: jest.fn(),
    approveTeam: jest.fn(),
    declineTeam: jest.fn(),
    addMember: jest.fn(),
    getTeamsForUser: jest.fn(),
    getTeamMembers: jest.fn(),
    updateMember: jest.fn(),
    updateTeam: jest.fn(),
  };

  const mockTeamLogoService = {
    setLogo: jest.fn(),
    removeLogo: jest.fn(),
    setAccent: jest.fn(),
    getLogo: jest.fn(),
  };

  const mockAuthService = {
    validateToken: jest.fn().mockResolvedValue(mockUser),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: TeamLogoService, useValue: mockTeamLogoService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAuthService.validateToken.mockResolvedValue(mockUser);
  });

  it('create() validates the token then creates the team for that user', async () => {
    const dto = { name: 'Core', approverEmail: 'naveyadai@gmail.com' };
    await controller.create(authHeader, dto);

    expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
    expect(mockTeamsService.create).toHaveBeenCalledWith(dto, mockUser.id);
  });

  it('getAllowedApprovers() validates the token then delegates to the service', async () => {
    await controller.getAllowedApprovers(authHeader);

    expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
    expect(mockTeamsService.getAllowedApprovers).toHaveBeenCalled();
  });

  it('approve() validates the token then approves as that user', async () => {
    await controller.approve(authHeader, 5);

    expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
    expect(mockTeamsService.approveTeam).toHaveBeenCalledWith(5, mockUser.id);
  });

  it('decline() validates the token then declines as that user', async () => {
    await controller.decline(authHeader, 5);

    expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
    expect(mockTeamsService.declineTeam).toHaveBeenCalledWith(5, mockUser.id);
  });

  it('addMember() validates the token then delegates to the service', async () => {
    const dto = { username: 'newmember', role: 'DEVELOPER' as any };
    await controller.addMember(authHeader, 5, dto);

    expect(mockTeamsService.addMember).toHaveBeenCalledWith(5, dto, mockUser.id);
  });

  it('getMyTeams() validates the token then fetches teams for that user', async () => {
    await controller.getMyTeams(authHeader);

    expect(mockTeamsService.getTeamsForUser).toHaveBeenCalledWith(mockUser.id);
  });

  it('getTeamMembers() validates the token then delegates to the service', async () => {
    await controller.getTeamMembers(authHeader, 5);

    expect(mockTeamsService.getTeamMembers).toHaveBeenCalledWith(5, mockUser.id);
  });

  it('updateMember() validates the token then delegates to the service', async () => {
    const dto = { isAdmin: true };
    await controller.updateMember(authHeader, 5, 7, dto);

    expect(mockTeamsService.updateMember).toHaveBeenCalledWith(5, 7, dto, mockUser.id);
  });

  it('update() validates the token then delegates to the service', async () => {
    const dto = { name: 'Renamed' };
    await controller.update(authHeader, 5, dto);

    expect(mockTeamsService.updateTeam).toHaveBeenCalledWith(5, dto, mockUser.id);
  });
  describe('team logo (feature 19)', () => {
    it('setLogo() validates the token first, then hands the file and accentHue to the service', async () => {
      const file = { buffer: Buffer.from([1, 2, 3]) };
      await controller.setLogo(authHeader, 7, file, { accentHue: '172' });

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
      expect(mockTeamLogoService.setLogo).toHaveBeenCalledWith(7, mockUser.id, file, '172');
    });

    it('removeLogo() and setAccent() pass the authenticated user, not anything from the body', async () => {
      await controller.removeLogo(authHeader, 7);
      expect(mockTeamLogoService.removeLogo).toHaveBeenCalledWith(7, mockUser.id);

      await controller.setAccent(authHeader, 7, { accentHue: 90 });
      expect(mockTeamLogoService.setAccent).toHaveBeenCalledWith(7, mockUser.id, 90);
    });

    it('getLogo() sends the bytes with the stored content type and an immutable private cache header', async () => {
      const data = Buffer.from([9, 9]);
      mockTeamLogoService.getLogo.mockResolvedValue({ data, contentType: 'image/png' });
      const res = { set: jest.fn(), send: jest.fn() };

      await controller.getLogo(authHeader, 7, res as any);

      expect(mockTeamLogoService.getLogo).toHaveBeenCalledWith(7, mockUser.id);
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      }));
      expect(res.send).toHaveBeenCalledWith(data);
    });

    it('an invalid token stops every logo endpoint before the service runs', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));
      await expect(controller.removeLogo(authHeader, 7)).rejects.toThrow('Invalid token');
      expect(mockTeamLogoService.removeLogo).not.toHaveBeenCalled();
    });
  });
});

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const params = {
    to: 'naveyadai@gmail.com',
    teamName: 'Core Team',
    creatorName: 'Dana',
    mainOffice: 'Haifa',
  };

  it('does not send (and does not throw) when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    const { EmailService } = require('./email.service');
    const service = new EmailService();

    await expect(service.sendTeamApprovalRequest(params)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends with the team name and creator name when a client is configured', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockResolvedValue({ id: 'email-1' });
    const { EmailService } = require('./email.service');
    const service = new EmailService();

    await service.sendTeamApprovalRequest(params);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: params.to,
        subject: expect.stringContaining(params.teamName),
        html: expect.stringContaining(params.creatorName),
      })
    );
  });

  it('does not throw when the underlying send call rejects', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockRejectedValue(new Error('network down'));
    const { EmailService } = require('./email.service');
    const service = new EmailService();

    await expect(service.sendTeamApprovalRequest(params)).resolves.toBeUndefined();
  });
});

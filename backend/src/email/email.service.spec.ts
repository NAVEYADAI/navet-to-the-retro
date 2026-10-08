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

describe('EmailService HTML escaping (BUG-23)', () => {
  const originalEnv = process.env;
  const evil = '<a href="https://evil.test">click</a>';

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: 'email-1' });
    process.env = { ...originalEnv, RESEND_API_KEY: 'test-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('escapes teamName, creatorName and mainOffice in the approval email html', async () => {
    const { EmailService } = require('./email.service');
    await new EmailService().sendTeamApprovalRequest({
      to: 'a@b.test',
      teamName: evil,
      creatorName: evil,
      mainOffice: evil,
    });

    const { html } = mockSend.mock.calls[0][0];
    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain('&lt;a href=&quot;https://evil.test&quot;&gt;click&lt;/a&gt;');
  });

  it('escapes teamName and inviterName in the join-invite email html', async () => {
    const { EmailService } = require('./email.service');
    await new EmailService().sendTeamJoinInvite({
      to: 'a@b.test',
      teamName: evil,
      inviterName: evil,
      token: 'tok',
    });

    const { html } = mockSend.mock.calls[0][0];
    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain('&lt;a href=');
    expect(html).toContain('/invite/tok"');
  });

  it('keeps the subject plain text (not HTML-escaped) but strips line breaks', async () => {
    const { EmailService } = require('./email.service');
    await new EmailService().sendTeamApprovalRequest({
      to: 'a@b.test',
      teamName: 'R&D\r\nBcc: x@y.test',
      creatorName: 'Dana',
    });

    const { subject } = mockSend.mock.calls[0][0];
    expect(subject).toContain('R&D');
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

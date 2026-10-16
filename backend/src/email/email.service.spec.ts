const mockSend = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => (mockCreateTransport as any)(...args),
}));

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

describe('EmailService transports (BUG-59)', () => {
  const originalEnv = process.env;
  const params = { to: 'lironka13@gmail.com', teamName: 'Core Team', creatorName: 'Dana' };

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    process.env = { ...originalEnv };
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends through SMTP (not Resend) when SMTP_USER and SMTP_PASS are set', async () => {
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.RESEND_API_KEY = 'test-key';
    mockSendMail.mockResolvedValue({ messageId: 'm1' });
    const { EmailService } = require('./email.service');

    await new EmailService().sendTeamApprovalRequest(params);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: params.to, from: expect.stringContaining('sender@gmail.com') })
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not throw when SMTP delivery fails', async () => {
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    mockSendMail.mockRejectedValue(new Error('auth failed'));
    const { EmailService } = require('./email.service');

    await expect(new EmailService().sendTeamJoinInvite({ ...params, inviterName: 'Dana', token: 't' })).resolves.toBeUndefined();
  });

  it('does not throw when Resend returns an error result instead of rejecting', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockResolvedValue({ data: null, error: { message: 'testing emails only' } });
    const { EmailService } = require('./email.service');

    await expect(new EmailService().sendTeamApprovalRequest(params)).resolves.toBeUndefined();
  });
});

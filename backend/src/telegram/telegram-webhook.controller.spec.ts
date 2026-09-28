import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramAdapterService } from './telegram-adapter.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramApiService } from './telegram-api.service';

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;
  const originalEnv = process.env;

  const mockAdapterService = { normalize: jest.fn() };
  const mockConversationService = {
    findActiveLink: jest.fn(),
    isDuplicateUpdate: jest.fn(),
    markProcessed: jest.fn(),
    handleTextMessage: jest.fn(),
  };
  const mockTelegramApi = { sendMessage: jest.fn() };

  const link = { id: 1, userId: 5, lastProcessedUpdateId: null };

  beforeEach(async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: 'shh-secret' };

    // `webhookSecret` is a per-instance field initializer (read in the constructor, like
    // GoogleCalendarController's frontendUrl), so it's enough to set the env var before building
    // a fresh controller instance below.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        { provide: TelegramAdapterService, useValue: mockAdapterService },
        { provide: TelegramConversationService, useValue: mockConversationService },
        { provide: TelegramApiService, useValue: mockTelegramApi },
      ],
    }).compile();

    controller = module.get(TelegramWebhookController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('rejects a request with a missing secret_token header', async () => {
    await expect(controller.handleWebhook(undefined, { update_id: 1 })).rejects.toThrow(UnauthorizedException);
    expect(mockAdapterService.normalize).not.toHaveBeenCalled();
  });

  it('rejects a request with a wrong secret_token header', async () => {
    await expect(controller.handleWebhook('wrong-secret', { update_id: 1 })).rejects.toThrow(UnauthorizedException);
    expect(mockAdapterService.normalize).not.toHaveBeenCalled();
  });

  it('ignores updates with no normalizable message (e.g. edited_message)', async () => {
    mockAdapterService.normalize.mockReturnValue(null);

    const result = await controller.handleWebhook('shh-secret', { update_id: 1 });

    expect(result).toEqual({ ok: true });
    expect(mockConversationService.findActiveLink).not.toHaveBeenCalled();
  });

  it('replies with the group-chat message and does not touch the conversation service for non-private chats', async () => {
    mockAdapterService.normalize.mockReturnValue({ externalId: '999', chatType: 'group', text: 'hi', updateId: 5 });

    const result = await controller.handleWebhook('shh-secret', { update_id: 5 });

    expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('999', expect.stringContaining('פרטי'));
    expect(mockConversationService.findActiveLink).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('replies with the not-linked message when there is no active link for this chat', async () => {
    mockAdapterService.normalize.mockReturnValue({ externalId: '111', chatType: 'private', text: 'hi', updateId: 5 });
    mockConversationService.findActiveLink.mockResolvedValue(null);

    const result = await controller.handleWebhook('shh-secret', { update_id: 5 });

    expect(mockConversationService.findActiveLink).toHaveBeenCalledWith('TELEGRAM', '111');
    expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('111', expect.stringContaining('לא מקושר'));
    expect(mockConversationService.handleTextMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('returns a silent no-op for a duplicate update_id (Telegram retry after suspend/resume) — no second reply', async () => {
    mockAdapterService.normalize.mockReturnValue({ externalId: '111', chatType: 'private', text: 'hi', updateId: 3 });
    mockConversationService.findActiveLink.mockResolvedValue(link);
    mockConversationService.isDuplicateUpdate.mockReturnValue(true);

    const result = await controller.handleWebhook('shh-secret', { update_id: 3 });

    expect(mockConversationService.isDuplicateUpdate).toHaveBeenCalledWith(link, 3);
    expect(mockTelegramApi.sendMessage).not.toHaveBeenCalled();
    expect(mockConversationService.handleTextMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('replies "text only" (and still marks the update processed) for a non-text message', async () => {
    mockAdapterService.normalize.mockReturnValue({ externalId: '111', chatType: 'private', text: undefined, updateId: 4 });
    mockConversationService.findActiveLink.mockResolvedValue(link);
    mockConversationService.isDuplicateUpdate.mockReturnValue(false);

    const result = await controller.handleWebhook('shh-secret', { update_id: 4 });

    expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('111', expect.stringContaining('טקסט בלבד'));
    expect(mockConversationService.markProcessed).toHaveBeenCalledWith(link.id, 4);
    expect(mockConversationService.handleTextMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('delegates a real text message to the conversation service', async () => {
    mockAdapterService.normalize.mockReturnValue({ externalId: '111', chatType: 'private', text: 'hello there', updateId: 6 });
    mockConversationService.findActiveLink.mockResolvedValue(link);
    mockConversationService.isDuplicateUpdate.mockReturnValue(false);

    const result = await controller.handleWebhook('shh-secret', { update_id: 6 });

    expect(mockConversationService.handleTextMessage).toHaveBeenCalledWith(link, 'hello there', 6);
    expect(result).toEqual({ ok: true });
  });
});

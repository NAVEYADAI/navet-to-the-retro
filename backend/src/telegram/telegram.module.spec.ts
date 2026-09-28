import axios from 'axios';
import { TelegramModule } from './telegram.module';
import { TelegramApiService } from './telegram-api.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// §10.0 default #10 — the webhook must be (re-)registered automatically on every process boot,
// not via a manual script/admin endpoint. `TelegramModule` is instantiated directly here (its
// `onModuleInit` only needs the one injected `TelegramApiService`) rather than through a full
// `Test.createTestingModule({imports: [TelegramModule]})`, which would otherwise also spin up
// every real sub-module (Prisma's real `$connect`, etc.) just to exercise this one lifecycle hook.
describe('TelegramModule::onModuleInit', () => {
  it('calls TelegramApiService.setWebhook() exactly once on module init', async () => {
    const mockSetWebhook = jest.fn().mockResolvedValue(undefined);
    const mockApiService = { setWebhook: mockSetWebhook } as unknown as TelegramApiService;

    const telegramModule = new TelegramModule(mockApiService);
    await telegramModule.onModuleInit();

    expect(mockSetWebhook).toHaveBeenCalledTimes(1);
  });
});

describe('TelegramApiService.setWebhook (invoked from onModuleInit)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      BACKEND_URL: 'https://backend.example.com',
    };
    mockedAxios.post.mockResolvedValue({ data: { ok: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('registers the webhook with the correct url and secret_token', async () => {
    const service = new TelegramApiService();
    await service.setWebhook();

    expect(mockedAxios.post).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/setWebhook', {
      url: 'https://backend.example.com/telegram/webhook',
      secret_token: 'test-secret',
    });
  });

  it('does nothing (no throw, no HTTP call) when TELEGRAM_BOT_TOKEN is not configured', async () => {
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_WEBHOOK_SECRET: 'test-secret' };
    const service = new TelegramApiService();

    await expect(service.setWebhook()).resolves.toBeUndefined();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('does nothing (no throw, no HTTP call) when TELEGRAM_WEBHOOK_SECRET is not configured', async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: undefined };
    const service = new TelegramApiService();

    await expect(service.setWebhook()).resolves.toBeUndefined();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('is safe to call again (idempotent no-op re-registration) without throwing', async () => {
    const service = new TelegramApiService();
    await service.setWebhook();
    await service.setWebhook();

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});

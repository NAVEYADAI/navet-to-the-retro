import axios from 'axios';
import { Logger } from '@nestjs/common';
import { TelegramApiService } from './telegram-api.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramApiService.sendMessage', () => {
  const originalEnv = process.env;
  let service: TelegramApiService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: 'bot-token' };
    service = new TelegramApiService();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn((e: any) => Boolean(e?.isAxiosError));
  });

  afterEach(() => {
    jest.clearAllMocks();
    errorSpy.mockRestore();
    process.env = originalEnv;
  });

  it('sends with parse_mode HTML (BUG-26)', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    await service.sendMessage('555', '<b>hi</b>');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({ chat_id: '555', text: '<b>hi</b>', parse_mode: 'HTML' })
    );
  });

  it('logs (at error level, with Telegram\'s description) instead of swallowing a failed send, and does not throw', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { status: 400, data: { description: "Bad Request: can't parse entities" } },
    });

    await expect(service.sendMessage('555', 'x')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("HTTP 400 - Bad Request: can't parse entities"));
  });

  it('logs non-axios errors too', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network down'));
    await service.sendMessage('555', 'x');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('network down'));
  });
});

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTeamLogo } from '../use-team-logo';
import { Strings } from '@/constants/strings';
import * as api from '@/features/teams/team-logo-api';
import * as pipeline from '@/features/teams/team-logo-pipeline';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/features/teams/team-logo-api');
jest.mock('@/features/teams/team-logo-pipeline');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedPipeline = pipeline as jest.Mocked<typeof pipeline>;

const ASSET = { uri: 'file:///picked.jpg', width: 800, height: 600 };
const PREPARED = { uri: 'file:///logo-256.png', hues: [172, 24, 280] };
const serverError = (message: string) => Object.assign(new Error('boom'), { response: { data: { message } } });

async function setup(over: Partial<Parameters<typeof useTeamLogo>[0]> = {}) {
  const onChanged = jest.fn();
  const hook = await renderHook(() =>
    useTeamLogo({ teamId: 7, token: 'tok', logoUpdatedAt: null, accentHue: null, onChanged, ...over })
  );
  return { ...hook, onChanged };
}

beforeEach(() => {
  mockedPipeline.pickLogoAsset.mockResolvedValue(ASSET);
  mockedPipeline.prepareLogo.mockResolvedValue(PREPARED);
});
afterEach(() => jest.resetAllMocks());

describe('useTeamLogo (feature 19)', () => {
  describe('upload', () => {
    it('picking + preparing opens the dialog with the dominant hue pre-selected', async () => {
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });

      expect(result.current.mode).toBe('upload');
      expect(result.current.prepared).toEqual(PREPARED);
      expect(result.current.hueOptions).toEqual([172, 24, 280]);
      expect(result.current.selectedHue).toBe(172);
      expect(trackEvent).toHaveBeenCalledWith('team_logo_pick_started', { replacing: false });
    });

    it('cancelling the system picker changes nothing', async () => {
      mockedPipeline.pickLogoAsset.mockResolvedValue(null);
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });
      expect(result.current.mode).toBe('idle');
      expect(mockedPipeline.prepareLogo).not.toHaveBeenCalled();
    });

    it('a logo with no dominant hue pre-selects "no team colour"', async () => {
      mockedPipeline.prepareLogo.mockResolvedValue({ uri: 'file:///bw.png', hues: [] });
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });
      expect(result.current.selectedHue).toBeNull();
      expect(result.current.hueOptions).toEqual([]);
    });

    it('a broken image shows the picking error and stays closed', async () => {
      mockedPipeline.prepareLogo.mockRejectedValue(new Error('decode'));
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });
      expect(result.current.mode).toBe('idle');
      expect(result.current.error).toBe(Strings.teamLogo.pickingError);
      expect(result.current.isBusy).toBe(false);
    });

    it('saving uploads the prepared file with the chosen hue, then closes and refreshes', async () => {
      mockedApi.uploadTeamLogo.mockResolvedValue({ logoUpdatedAt: 'x', accentHue: 24 });
      const { result, onChanged } = await setup();
      await act(async () => { await result.current.startUpload(); });
      await act(async () => { result.current.selectHue(24); });
      await act(async () => { await result.current.save(); });

      expect(mockedApi.uploadTeamLogo).toHaveBeenCalledWith(7, 'tok', { uri: PREPARED.uri, accentHue: 24 });
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('idle');
      expect(trackEvent).toHaveBeenCalledWith('team_logo_saved', expect.objectContaining({ has_color: true, replaced: false, color_candidate_index: 1 }));
    });

    it('"no team colour" uploads a null hue', async () => {
      mockedApi.uploadTeamLogo.mockResolvedValue({ logoUpdatedAt: 'x', accentHue: null });
      const { result } = await setup({ logoUpdatedAt: '2026-01-01' });
      await act(async () => { await result.current.startUpload(); });
      await act(async () => { result.current.selectHue(null); });
      await act(async () => { await result.current.save(); });

      expect(mockedApi.uploadTeamLogo).toHaveBeenCalledWith(7, 'tok', { uri: PREPARED.uri, accentHue: null });
      expect(trackEvent).toHaveBeenCalledWith('team_logo_saved', expect.objectContaining({ has_color: false, replaced: true }));
    });

    it('a server rejection keeps the dialog open with the server message and does not refresh', async () => {
      mockedApi.uploadTeamLogo.mockRejectedValue(serverError('סוג הקובץ לא נתמך, יש להעלות PNG או JPG'));
      const { result, onChanged } = await setup();
      await act(async () => { await result.current.startUpload(); });
      await act(async () => { await result.current.save(); });

      expect(result.current.mode).toBe('upload');
      expect(result.current.error).toBe('סוג הקובץ לא נתמך, יש להעלות PNG או JPG');
      expect(onChanged).not.toHaveBeenCalled();
      expect(result.current.isBusy).toBe(false);
    });

    it('falls back to a generic message when the failure has no server message', async () => {
      mockedApi.uploadTeamLogo.mockRejectedValue(new Error('network'));
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });
      await act(async () => { await result.current.save(); });
      expect(result.current.error).toBe(Strings.teamLogo.uploadError);
    });

    it('cancel closes the dialog and discards the prepared file without uploading', async () => {
      const { result } = await setup();
      await act(async () => { await result.current.startUpload(); });
      await act(async () => { result.current.cancel(); });
      expect(result.current.mode).toBe('idle');
      expect(result.current.prepared).toBeNull();
      expect(mockedApi.uploadTeamLogo).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('asks first, then removes and refreshes', async () => {
      mockedApi.removeTeamLogo.mockResolvedValue({ logoUpdatedAt: null, accentHue: null });
      const { result, onChanged } = await setup({ logoUpdatedAt: '2026-01-01', accentHue: 172 });

      await act(async () => { result.current.askRemove(); });
      expect(result.current.isConfirmingRemove).toBe(true);
      expect(mockedApi.removeTeamLogo).not.toHaveBeenCalled();

      await act(async () => { await result.current.confirmRemove(); });
      expect(mockedApi.removeTeamLogo).toHaveBeenCalledWith(7, 'tok');
      expect(result.current.isConfirmingRemove).toBe(false);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('cancelling the confirmation removes nothing', async () => {
      const { result } = await setup({ logoUpdatedAt: '2026-01-01' });
      await act(async () => { result.current.askRemove(); });
      await act(async () => { result.current.cancelRemove(); });
      expect(result.current.isConfirmingRemove).toBe(false);
      expect(mockedApi.removeTeamLogo).not.toHaveBeenCalled();
    });

    it('a failed removal closes the confirmation and shows the error', async () => {
      mockedApi.removeTeamLogo.mockRejectedValue(new Error('network'));
      const { result, onChanged } = await setup({ logoUpdatedAt: '2026-01-01' });
      await act(async () => { result.current.askRemove(); });
      await act(async () => { await result.current.confirmRemove(); });
      expect(result.current.error).toBe(Strings.teamLogo.removeError);
      expect(result.current.isConfirmingRemove).toBe(false);
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('changing the colour of the stored logo', () => {
    beforeEach(() => {
      mockedPipeline.loadStoredLogoHues.mockResolvedValue([172, 24]);
    });

    it('offers the hues found in the stored logo with the current one selected', async () => {
      const { result } = await setup({ logoUpdatedAt: '2026-01-01', accentHue: 24 });
      await act(async () => { await result.current.startRecolor(); });
      expect(result.current.mode).toBe('recolor');
      expect(result.current.hueOptions).toEqual([172, 24]);
      expect(result.current.selectedHue).toBe(24);
      expect(mockedPipeline.loadStoredLogoHues).toHaveBeenCalledWith(
        expect.stringContaining('/teams/7/logo?v=2026-01-01'),
        { Authorization: 'Bearer tok' }
      );
    });

    it('always lists the current colour, even if it is no longer one of the detected hues', async () => {
      const { result } = await setup({ logoUpdatedAt: '2026-01-01', accentHue: 300 });
      await act(async () => { await result.current.startRecolor(); });
      expect(result.current.hueOptions[0]).toBe(300);
      expect(result.current.hueOptions).toHaveLength(3);
    });

    it('saving sends only the hue (no file), and null clears the colour', async () => {
      mockedApi.updateTeamAccent.mockResolvedValue({ logoUpdatedAt: 'x', accentHue: null });
      const { result, onChanged } = await setup({ logoUpdatedAt: '2026-01-01', accentHue: 24 });
      await act(async () => { await result.current.startRecolor(); });
      await act(async () => { result.current.selectHue(null); });
      await act(async () => { await result.current.saveRecolor(); });

      expect(mockedApi.updateTeamAccent).toHaveBeenCalledWith(7, 'tok', null);
      expect(mockedApi.uploadTeamLogo).not.toHaveBeenCalled();
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('idle');
    });

    it('a failed lookup stays closed with the colour error', async () => {
      mockedPipeline.loadStoredLogoHues.mockRejectedValue(new Error('network'));
      const { result } = await setup({ logoUpdatedAt: '2026-01-01', accentHue: 24 });
      await act(async () => { await result.current.startRecolor(); });
      await waitFor(() => expect(result.current.error).toBe(Strings.teamLogo.accentError));
      expect(result.current.mode).toBe('idle');
    });
  });
});

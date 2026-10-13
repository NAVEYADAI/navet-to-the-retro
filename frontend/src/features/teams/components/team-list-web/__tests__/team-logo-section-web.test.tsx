/**
 * @jest-environment jsdom
 */
import React from 'react';
import { TeamLogoSection } from '../team-logo-section';
import { Strings } from '@/constants/strings';
import * as api from '@/features/teams/team-logo-api';
import * as pipeline from '@/features/teams/team-logo-pipeline';
import { mountWeb, clickText, findByText, type Mounted } from '@/test-utils/web-dom';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
// Factory mocks: an automock would load the real modules first, and axios / expo-image-picker can't
// load in this jsdom environment.
jest.mock('@/features/teams/team-logo-api', () => ({
  uploadTeamLogo: jest.fn(),
  removeTeamLogo: jest.fn(),
  updateTeamAccent: jest.fn(),
}));
jest.mock('@/features/teams/team-logo-pipeline', () => ({
  pickLogoAsset: jest.fn(),
  prepareLogo: jest.fn(),
  loadStoredLogoHues: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedPipeline = pipeline as jest.Mocked<typeof pipeline>;

let mounted: Mounted | null = null;
const onChanged = jest.fn();
const mount = (over: Partial<React.ComponentProps<typeof TeamLogoSection>> = {}) =>
  mountWeb(
    <TeamLogoSection teamId={3} token="tok" teamName="פיתוח" logoUpdatedAt={null} accentHue={null} onChanged={onChanged} {...over} />
  );
const text = () => mounted!.container.textContent ?? '';

// Native ui variants (jest-expo picks the .native files) render RN primitives inside jsdom here,
// which React logs as unknown tags — same noise the other web tests silence.
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('TeamLogoSection (web, feature 19)', () => {
  it('a team without a logo sees the explanation and an upload button — and no remove/colour controls', async () => {
    mounted = await mount();
    expect(text()).toContain(Strings.teamLogo.sectionTitle);
    expect(text()).toContain(Strings.teamLogo.emptyDescription);
    expect(findByText(mounted.container, Strings.teamLogo.uploadButton)).not.toBeNull();
    expect(findByText(mounted.container, Strings.teamLogo.removeButton)).toBeNull();
    expect(findByText(mounted.container, Strings.teamLogo.colorChangeButton)).toBeNull();
    expect(mounted.container.querySelector('[data-testid="team-color-swatch"]')).toBeNull();
  });

  it('a team with a logo and a colour shows replace / remove and where the colour came from', async () => {
    mounted = await mount({ logoUpdatedAt: '2026-10-13T10:00:00.000Z', accentHue: 172 });
    expect(findByText(mounted.container, Strings.teamLogo.replaceButton)).not.toBeNull();
    expect(findByText(mounted.container, Strings.teamLogo.removeButton)).not.toBeNull();
    expect(text()).toContain(Strings.teamLogo.colorFromLogo);
    expect(text()).toContain(Strings.teamLogo.colorScopeHint);
    expect(findByText(mounted.container, Strings.teamLogo.uploadButton)).toBeNull();
  });

  it('a logo without a team colour says so', async () => {
    mounted = await mount({ logoUpdatedAt: '2026-10-13T10:00:00.000Z', accentHue: null });
    expect(text()).toContain(Strings.teamLogo.colorNone);
    expect(text()).toContain(Strings.teamLogo.colorNoneHint);
  });

  it('remove asks for confirmation first, and only then calls the API and refreshes', async () => {
    mockedApi.removeTeamLogo.mockResolvedValue({ logoUpdatedAt: null, accentHue: null });
    mounted = await mount({ logoUpdatedAt: '2026-10-13T10:00:00.000Z', accentHue: 172 });

    await clickText(mounted.container, Strings.teamLogo.removeButton);
    expect(text()).toContain(Strings.teamLogo.removeConfirmTitle);
    expect(mockedApi.removeTeamLogo).not.toHaveBeenCalled();

    await clickText(mounted.container, Strings.teamLogo.removeConfirmButton);
    expect(mockedApi.removeTeamLogo).toHaveBeenCalledWith(3, 'tok');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('cancelling the removal confirmation leaves the logo alone', async () => {
    mounted = await mount({ logoUpdatedAt: '2026-10-13T10:00:00.000Z' });
    await clickText(mounted.container, Strings.teamLogo.removeButton);
    await clickText(mounted.container, Strings.teamLogo.cancelButton);
    expect(mockedApi.removeTeamLogo).not.toHaveBeenCalled();
    expect(text()).not.toContain(Strings.teamLogo.removeConfirmTitle);
  });

  it('a failed removal shows the error', async () => {
    mockedApi.removeTeamLogo.mockRejectedValue(new Error('network'));
    mounted = await mount({ logoUpdatedAt: '2026-10-13T10:00:00.000Z' });
    await clickText(mounted.container, Strings.teamLogo.removeButton);
    await clickText(mounted.container, Strings.teamLogo.removeConfirmButton);
    expect(text()).toContain(Strings.teamLogo.removeError);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('the upload button opens the system picker', async () => {
    mockedPipeline.pickLogoAsset.mockResolvedValue(null);
    mounted = await mount();
    await clickText(mounted.container, Strings.teamLogo.uploadButton);
    expect(mockedPipeline.pickLogoAsset).toHaveBeenCalledTimes(1);
    expect(mockedApi.uploadTeamLogo).not.toHaveBeenCalled();
  });
});

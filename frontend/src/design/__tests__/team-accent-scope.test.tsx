import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppAccentScope, AppThemeProvider, TeamAccentScope, useTheme } from '@/design/theme-context';
import { accentSchemes } from '@/design/tokens';
import { teamAccentFromHue } from '@/design/team-accent';

function Probe({ id }: { id: string }) {
  const t = useTheme();
  return <Text testID={id}>{`${t.color.accent.base}|${t.color.appAccent.base}|${t.color.status.success.fg}`}</Text>;
}
const read = (id: string) => {
  const [accent, appAccent, success] = String(screen.getByTestId(id).props.children).split('|');
  return { accent, appAccent, success };
};

describe('TeamAccentScope (feature 19)', () => {
  it('outside any scope, accent and appAccent are the same app colour', async () => {
    await render(<AppThemeProvider><Probe id="p" /></AppThemeProvider>);
    const { accent, appAccent } = read('p');
    expect(accent).toBe(accentSchemes.blue.base);
    expect(appAccent).toBe(accent);
  });

  it('inside a scope accent becomes the team colour while appAccent and the semantic tones stay', async () => {
    await render(
      <AppThemeProvider>
        <Probe id="outside" />
        <TeamAccentScope hue={172}><Probe id="inside" /></TeamAccentScope>
      </AppThemeProvider>
    );
    const outside = read('outside');
    const inside = read('inside');
    expect(inside.accent).toBe(teamAccentFromHue(172, 'light').base);
    expect(inside.accent).not.toBe(outside.accent);
    expect(inside.appAccent).toBe(outside.appAccent);
    expect(inside.success).toBe(outside.success); // שימור/שיפור, סטטוסים — לא נצבעים
  });

  it.each([null, undefined])('a %s hue is a no-op: no team colour, the area keeps the app accent', async (hue) => {
    await render(<AppThemeProvider><TeamAccentScope hue={hue}><Probe id="p" /></TeamAccentScope></AppThemeProvider>);
    const { accent, appAccent } = read('p');
    expect(accent).toBe(appAccent);
  });

  it('hue 0 is a real colour, not "no colour"', async () => {
    await render(<AppThemeProvider><TeamAccentScope hue={0}><Probe id="p" /></TeamAccentScope></AppThemeProvider>);
    expect(read('p').accent).toBe(teamAccentFromHue(0, 'light').base);
  });

  it('AppAccentScope gives the semantic markers (highlight, "posted on behalf") the app colour back', async () => {
    await render(
      <AppThemeProvider>
        <TeamAccentScope hue={172}>
          <Probe id="team" />
          <AppAccentScope><Probe id="app" /></AppAccentScope>
        </TeamAccentScope>
      </AppThemeProvider>
    );
    expect(read('team').accent).toBe(teamAccentFromHue(172, 'light').base);
    expect(read('app').accent).toBe(accentSchemes.blue.base);
  });

  it('a nested scope wins over the outer one', async () => {
    await render(
      <AppThemeProvider>
        <TeamAccentScope hue={10}>
          <TeamAccentScope hue={200}><Probe id="p" /></TeamAccentScope>
        </TeamAccentScope>
      </AppThemeProvider>
    );
    expect(read('p').accent).toBe(teamAccentFromHue(200, 'light').base);
  });
});

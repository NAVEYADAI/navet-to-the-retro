import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme, usePreferences } from '@/design/theme-context';
import { accentSchemes, accentSchemesDark, type AccentScheme } from '@/design/tokens';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { CardNative, rnText } from './settings-native-parts';

/** Native counterpart of ui/Segmented (MUI, web only) — exclusive choice from 2-4 options. */
function SegmentedNative<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignSelf: 'flex-end',
        gap: 3,
        padding: 3,
        backgroundColor: t.color.surfaceSubtle,
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.field,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{
              minHeight: t.layout.minTouchTarget - 8,
              paddingHorizontal: t.space[3],
              justifyContent: 'center',
              borderRadius: t.radius.badge,
              backgroundColor: active ? t.color.surface : 'transparent',
            }}
          >
            <Text style={[rnText({ ...t.type.label, fontWeight: active ? 600 : 500 }), { color: active ? t.color.text : t.color.textSecondary }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2] }}>
      <View>
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{label}</Text>
        <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

/** Personal appearance preferences (mode / accent scheme / density) — persisted per device by AppThemeProvider. */
export function AppearanceCardNative() {
  const t = useTheme();
  const { prefs, setPrefs } = usePreferences();
  const S = Strings.settings;
  const divider = <View style={{ height: 1, backgroundColor: t.color.border }} />;

  return (
    <CardNative title={S.appearanceCardTitle} subtitle={S.appearanceCardSubtitle}>
      <Row label={S.modeLabel} hint={S.modeHint}>
        <SegmentedNative
          value={prefs.mode}
          onChange={(mode) => {
            trackEvent('appearance_mode_changed', { mode });
            setPrefs({ mode });
          }}
          options={[
            { value: 'light', label: S.modeLight },
            { value: 'dark', label: S.modeDark },
            { value: 'system', label: S.modeSystem },
          ]}
        />
      </Row>

      {divider}

      <Row label={S.schemeLabel} hint={S.schemeHint}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] + 2 }}>
          {(Object.keys(accentSchemes) as AccentScheme[]).map((key) => {
            const active = prefs.scheme === key;
            const schemeColor = (t.mode === 'dark' ? accentSchemesDark : accentSchemes)[key];
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  trackEvent('appearance_scheme_changed', { scheme: key });
                  setPrefs({ scheme: key });
                }}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  height: t.layout.minTouchTarget,
                  paddingHorizontal: t.space[3],
                  justifyContent: 'center',
                  borderRightWidth: 4,
                  borderRightColor: schemeColor.base,
                  backgroundColor: schemeColor.subtle,
                  borderRadius: t.radius.field,
                  borderWidth: active ? 2 : 0,
                  borderColor: schemeColor.base,
                }}
              >
                <Text
                  style={[
                    rnText({ ...t.type.label, fontWeight: active ? 600 : 500 }),
                    { color: active ? schemeColor.base : t.color.textSecondary, textAlign: 'right' },
                  ]}
                >
                  {S.schemeNames[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Row>

      {divider}

      <Row label={S.densityLabel} hint={S.densityHint}>
        <SegmentedNative
          value={prefs.density}
          onChange={(density) => {
            trackEvent('appearance_density_changed', { density });
            setPrefs({ density });
          }}
          options={[
            { value: 'compact', label: S.densityCompact },
            { value: 'regular', label: S.densityRegular },
          ]}
        />
      </Row>
    </CardNative>
  );
}

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import type { Tone } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { animateNextLayout } from '@/lib/animate-layout';
import { formatDateCompact } from '@/lib/format-date';
import { daysUntilStart, getSprintProgress } from '../sprint-lifecycle';

/** שורות רשימת הספרינטים בכרטיס הצוות (native), לפי אותו מוקאפ כמו ה-web. */

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

function SprintBadge({ tone, label }: { tone: Exclude<Tone, 'accent'>; label: string }) {
  const t = useTheme();
  const c = t.color.status[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[2], paddingVertical: 2 }}>
      <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** שורה אחת: שם+תאריכים (מצטמצם ונשבר בתוך העמודה), ואחריו התוכן של הקצה — בלי לרדת שורה. */
function SprintRow({ sprint, muted, onPress, children }: { sprint: any; muted?: boolean; onPress: () => void; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={() => { trackEvent('sprint_opened', { sprintId: sprint.id }); onPress(); }}
      style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], paddingVertical: t.space[3], borderBottomWidth: 1, borderBottomColor: t.color.border, opacity: muted ? 0.72 : 1 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[rnText(t.type.rowTitle), { color: t.color.text, textAlign: 'right' }]}>{sprint.name}</Text>
        <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
          {`${formatDateCompact(sprint.startDate)} – ${formatDateCompact(sprint.endDate)}`}
        </Text>
      </View>
      {children}
    </TouchableOpacity>
  );
}

/**
 * תג (אופציונלי) וקישור יחד בקצה השורה, בלי להתכווץ. ברירת המחדל "כניסה ללוח" (השורה עצמה לוחצת);
 * עם `onOpenSummary` הקישור הוא "סיכום" — כפתור נפרד, כי הוא מוביל למקום אחר מהשורה.
 */
function RowEnd({ children, onOpenSummary }: { children?: React.ReactNode; onOpenSummary?: () => void }) {
  const t = useTheme();
  const linkStyle = [rnText(t.type.bodyStrong), { color: t.color.accent.base }];
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], flexShrink: 0 }}>
      {children}
      {onOpenSummary ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onOpenSummary}
          style={{ minHeight: t.layout.minTouchTarget, justifyContent: 'center' }}
        >
          <Text style={linkStyle}>{Strings.sprints.summaryLink}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={linkStyle}>{Strings.sprints.enterRetroButton}</Text>
      )}
    </View>
  );
}

/** ספרינטים קיימים אבל אף אחד לא רץ או מתוכנן — במקום רשימה ריקה. מנהל מקבל קישור לפתיחת ספרינט. */
export function NoActiveSprintRow({ onCreate }: { onCreate?: () => void }) {
  const t = useTheme();
  return (
    <View
      testID="no-active-sprint"
      style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: t.space[3], paddingVertical: t.space[2], borderBottomWidth: 1, borderBottomColor: t.color.border }}
    >
      <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.sprints.noActiveSprintText}</Text>
      {onCreate ? (
        <TouchableOpacity accessibilityRole="button" onPress={onCreate} style={{ minHeight: t.layout.minTouchTarget, justifyContent: 'center' }}>
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.base }]}>{Strings.sprints.createSprintLink}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function OpenSprintRow({ sprint, state, onPress }: { sprint: any; state: 'active' | 'upcoming'; onPress: () => void }) {
  const t = useTheme();
  const progress = state === 'active' ? getSprintProgress(sprint.startDate, sprint.endDate) : null;
  return (
    <SprintRow sprint={sprint} onPress={onPress}>
      {/* בטלפון פס ההתקדמות כבר אומר "פעיל", אז בשורה פעילה אין תג — כך הכל נשאר בשורה אחת. */}
      {progress ? (
        <>
          <View style={{ width: 84, flexShrink: 1, gap: t.space[1], marginLeft: t.space[2] }}>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
              style={{ height: 6, borderRadius: t.radius.pill, backgroundColor: t.color.border, overflow: 'hidden', flexDirection: 'row-reverse' }}
            >
              <View style={{ width: `${progress.percent}%`, borderRadius: t.radius.pill, backgroundColor: t.color.status.success.fg }} />
            </View>
            <Text numberOfLines={1} style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
              {Strings.sprints.progressText(progress.day, progress.total)}
            </Text>
          </View>
          <RowEnd />
        </>
      ) : (
        <RowEnd>
          <SprintBadge tone="warning" label={Strings.sprints.startsInBadge(daysUntilStart(sprint.startDate))} />
        </RowEnd>
      )}
    </SprintRow>
  );
}

/** `onOpenSummary` רק למי שמורשה לסיכום (מנהלים) — אחרת "כניסה ללוח" כמו כל השאר. */
export function RecentSprintsGroup({ sprints, onSelect, onOpenSummary }: { sprints: any[]; onSelect: (sprint: any) => void; onOpenSummary?: (sprint: any) => void }) {
  const t = useTheme();
  return (
    <View>
      <Text style={[rnText(t.type.overline), { color: t.color.textMuted, textAlign: 'right', paddingTop: t.space[4], paddingBottom: t.space[1] }]}>
        {Strings.sprints.recentHeader}
      </Text>
      {sprints.map((sprint) => (
        <SprintRow key={sprint.id} sprint={sprint} muted onPress={() => onSelect(sprint)}>
          <RowEnd onOpenSummary={onOpenSummary ? () => onOpenSummary(sprint) : undefined}>
            <SprintBadge tone="neutral" label={Strings.sprints.endedBadge} />
          </RowEnd>
        </SprintRow>
      ))}
    </View>
  );
}

export function ExpiredSprintsGroup({ sprints, onSelect }: { sprints: any[]; onSelect: (sprint: any) => void }) {
  const t = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        testID="toggle-expired-sprints"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => { trackEvent('sprint_expired_toggled', { open: !isOpen }); animateNextLayout(); setIsOpen(!isOpen); }}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], minHeight: t.layout.minTouchTarget, marginVertical: t.space[2], paddingHorizontal: t.space[2] }}
      >
        <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
        <Text style={[rnText(t.type.label), { color: t.color.textSecondary }]}>{Strings.sprints.expiredHeader(sprints.length)}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={{ paddingHorizontal: t.space[2], paddingBottom: t.space[3] }}>
          {sprints.map((sprint) => (
            <TouchableOpacity
              key={sprint.id}
              onPress={() => { trackEvent('sprint_opened', { sprintId: sprint.id }); onSelect(sprint); }}
              style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.color.border, opacity: 0.72 }}
            >
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{sprint.name}</Text>
              <Text style={[rnText(t.type.caption), { color: t.color.textSecondary }]}>
                {`${formatDateCompact(sprint.startDate)} – ${formatDateCompact(sprint.endDate)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { getRoleLabel } from './roles';
import { ROLES } from '@/constants/roles';
import { usePhantomConversionLink, PhantomConversionButton, PhantomConversionPanel } from './phantom-conversion-link';

interface TeamMemberRowProps {
  member: any;
  teamId: number;
  token: string;
  isTeamAdmin: boolean;
  isMe: boolean;
  onChanged: () => void;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #1) —
  // `isAdmin || role === 'TEAM_LEADER'`, NOT the same as `isTeamAdmin` (isAdmin-only) above.
  // Gates the "send registration link" action, distinct from the existing edit/remove actions.
  canManageTeamContent?: boolean;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function TeamMemberRow({ member, teamId, token, isTeamAdmin, isMe, onChanged, canManageTeamContent }: TeamMemberRowProps) {
  const t = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState(member.role);
  const [editIsAdmin, setEditIsAdmin] = useState(member.isAdmin);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const startEdit = () => {
    setEditRole(member.role);
    setEditIsAdmin(member.isAdmin);
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setEditError(null);
    setEditLoading(true);
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/members/${member.id}`, {
        role: editRole,
        isAdmin: editIsAdmin
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsEditing(false);
      onChanged();
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || 'שמירת השינויים נכשלה.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRemove = async () => {
    setRemoveError(null);
    setIsRemoving(true);
    try {
      await axios.delete(`${getBackendUrl()}/teams/${teamId}/members/${member.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onChanged();
    } catch (err: any) {
      setRemoveError(err.response?.data?.message || err.message || 'הסרת חבר הצוות נכשלה.');
    } finally {
      setIsRemoving(false);
    }
  };

  const fullName = member.user?.firstName || member.user?.lastName
    ? `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim()
    : `@${member.user?.username || ''}`;
  const roleBadgeLabel = getRoleLabel(member.role);
  const currentRoleIcon = ROLES.find((r) => r.value === member.role)?.icon;
  const isPhantomManageable = member.user?.isPhantom === true && canManageTeamContent;
  const conversion = usePhantomConversionLink({ teamId, memberId: member.id, token });

  if (isEditing) {
    return (
      <View
        style={{
          padding: t.space[3],
          borderRadius: t.radius.card,
          backgroundColor: t.color.surfaceSubtle,
          gap: t.space[2],
        }}
      >
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
          {Strings.teamList.editMemberHeader(member.user?.username)}
        </Text>

        {!!editError && (
          <View
            style={{
              backgroundColor: t.color.status.danger.bg,
              borderWidth: 1,
              borderColor: t.color.status.danger.border,
              borderRadius: t.radius.field,
              padding: t.space[2],
            }}
          >
            <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
              {editError}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[1] + 2 }}>
          {ROLES.map((r) => {
            const selected = editRole === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: t.space[1],
                  paddingHorizontal: t.space[3],
                  paddingVertical: t.space[1] + 3,
                  borderRadius: t.radius.pill,
                  borderWidth: 1.5,
                  borderColor: selected ? t.color.accent.base : t.color.border,
                  backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                }}
                onPress={() => setEditRole(r.value)}
              >
                <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
                <Text style={[rnText({ ...t.type.caption, fontWeight: selected ? 700 : 500 }), { color: selected ? t.color.accent.base : t.color.textSecondary }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          <Text style={[rnText(t.type.body), { color: t.color.text, flexShrink: 1 }]}>{Strings.teamList.teamAdminPrivileges}</Text>
          <Switch
            value={editIsAdmin}
            onValueChange={setEditIsAdmin}
            trackColor={{ false: t.color.border, true: t.color.accent.border }}
            thumbColor={editIsAdmin ? t.color.accent.base : t.color.surface}
          />
        </View>

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
          <TouchableOpacity
            style={{
              backgroundColor: t.color.accent.base,
              borderRadius: t.radius.field,
              minHeight: t.layout.minTouchTarget,
              paddingHorizontal: t.space[4],
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleSaveEdit}
            disabled={editLoading}
          >
            {editLoading ? (
              <ActivityIndicator size="small" color={t.color.accent.onBase} />
            ) : (
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                {Strings.teamList.saveButton}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: t.color.surface,
              borderWidth: 1,
              borderColor: t.color.border,
              borderRadius: t.radius.field,
              minHeight: t.layout.minTouchTarget,
              paddingHorizontal: t.space[4],
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setIsEditing(false)}
          >
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.text }]}>
              {Strings.teamList.cancelButton}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        padding: t.space[3],
        borderRadius: t.radius.card,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
        gap: t.space[2],
      }}
    >
      {!!removeError && (
        <View
          style={{
            backgroundColor: t.color.status.danger.bg,
            borderWidth: 1,
            borderColor: t.color.status.danger.border,
            borderRadius: t.radius.field,
            padding: t.space[2],
          }}
        >
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
            {removeError}
          </Text>
        </View>
      )}

      {/*
        שני View נפרדים בטור, לא שורה אחת עם justify-content:space-between+flexWrap — עם 4-5
        badge/כפתור בצד השני, ה-wrap-כשצריך נשבר בנקודה לא-עקבית ותמיד נראה "מלא מדי" גם כשטכנית
        נכנס. ראה UI-GUIDELINES §11 "שורת מידע + אשכול פעולות" (אותו תיקון בגרסת ה-web).
      */}
      <View style={{ gap: t.space[2] }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], flexWrap: 'wrap', flexShrink: 1 }}>
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
            {fullName}
          </Text>
          {member.status === 'PENDING' && (
            <View
              style={{
                backgroundColor: t.color.accent.subtle,
                borderWidth: 1,
                borderColor: t.color.accent.border,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[2],
                paddingVertical: 2,
              }}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.accent.base }]}>
                {Strings.teamList.pendingMemberBadge}
              </Text>
            </View>
          )}
          {member.user?.isPhantom === true && (
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                backgroundColor: t.color.surfaceSubtle,
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[2],
                paddingVertical: 2,
              }}
            >
              <Icon name="ghost" size="sm" tone="muted" />
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.textSecondary }]}>
                {Strings.teamList.phantomBadge}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], flexWrap: 'wrap' }}>
          {member.isAdmin && (
            <View
              style={{
                backgroundColor: t.color.surfaceSubtle,
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[2],
                paddingVertical: 2,
              }}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.textSecondary }]}>
                {Strings.teamList.adminBadge}
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: t.space[1],
              backgroundColor: t.color.accent.subtle,
              borderWidth: 1.5,
              borderColor: t.color.accent.base,
              borderRadius: t.radius.pill,
              paddingHorizontal: t.space[3],
              paddingVertical: t.space[1],
            }}
          >
            {currentRoleIcon ? <Icon name={currentRoleIcon} size="sm" tone="accent" /> : null}
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.accent.base }]}>
              {roleBadgeLabel}
            </Text>
          </View>

          {isPhantomManageable && <PhantomConversionButton state={conversion} />}

          {isTeamAdmin && (
            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: t.space[2],
                paddingVertical: t.space[1],
                borderRadius: t.radius.field,
              }}
              onPress={startEdit}
            >
              <Icon name="edit" size="sm" />
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.text }]}>
                ערוך
              </Text>
            </TouchableOpacity>
          )}
          {isTeamAdmin && (
            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: t.space[2],
                paddingVertical: t.space[1],
                borderRadius: t.radius.field,
                backgroundColor: isMe ? t.color.surfaceSubtle : t.color.status.danger.bg,
              }}
              onPress={handleRemove}
              disabled={isMe || isRemoving}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color={t.color.status.danger.fg} />
              ) : (
                <>
                  <Icon name="trash" size="sm" tone={isMe ? 'muted' : 'danger'} />
                  <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: isMe ? t.color.textMuted : t.color.status.danger.fg }]}>
                    הסר
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isPhantomManageable && <PhantomConversionPanel state={conversion} />}
    </View>
  );
}

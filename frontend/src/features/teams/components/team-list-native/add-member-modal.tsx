import React, { useState } from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Modal } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { AddMemberForm } from './add-member-form';
import { AddPhantomMemberForm } from './add-phantom-member-form';
import { InviteLinksPanel } from './invite-links-panel';

export type AddMemberTab = 'existing' | 'phantom' | 'link';

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  teamId: number;
  teamName: string;
  token: string;
  canInvite: boolean;
  canAddPhantom: boolean;
  onMemberAdded: () => void;
}

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

// Native twin of team-list-web/add-member-modal.tsx — one "הוסף חבר" entry point, three tabs.
export function AddMemberModal({ open, onClose, teamId, teamName, token, canInvite, canAddPhantom, onMemberAdded }: AddMemberModalProps) {
  const t = useTheme();
  const options: { value: AddMemberTab; label: string }[] = [];
  if (canInvite) options.push({ value: 'existing', label: Strings.teamList.addMemberTabExisting });
  if (canAddPhantom) options.push({ value: 'phantom', label: Strings.teamList.addMemberTabPhantom });
  if (canInvite) options.push({ value: 'link', label: Strings.teamList.addMemberTabLink });

  const [tab, setTab] = useState<AddMemberTab>(options[0]?.value ?? 'existing');
  const activeTab = options.some((o) => o.value === tab) ? tab : options[0]?.value;

  const handleDone = () => {
    onClose();
    onMemberAdded();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={Strings.teamList.addMemberModalTitle}
      subtitle={teamName}
      closeLabel={Strings.teamList.closeModalLabel}
    >
      {options.length > 1 && (
        <View style={{ flexDirection: 'row-reverse', gap: 3, padding: 3, backgroundColor: t.color.surfaceSubtle, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
          {options.map((o) => {
            const active = activeTab === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() => {
                  trackEvent('add_member_tab_changed', { tab: o.value });
                  setTab(o.value);
                }}
                style={{
                  flex: 1,
                  minHeight: t.layout.minTouchTarget - 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: t.space[1],
                  borderRadius: t.radius.badge,
                  backgroundColor: active ? t.color.surface : 'transparent',
                }}
              >
                <Text style={[rnText({ ...t.type.label, fontWeight: active ? 600 : 500 }), { color: active ? t.color.text : t.color.textSecondary, textAlign: 'center' }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {activeTab === 'existing' && <AddMemberForm teamId={teamId} token={token} onInviteSent={handleDone} />}
      {activeTab === 'phantom' && <AddPhantomMemberForm teamId={teamId} token={token} onCreated={handleDone} />}
      {activeTab === 'link' && <InviteLinksPanel teamId={teamId} token={token} />}
    </Modal>
  );
}

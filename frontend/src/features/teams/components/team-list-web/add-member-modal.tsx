import React, { useState } from 'react';
import { Strings } from '@/constants/strings';
import { Modal, Segmented } from '@/components/ui';
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
  /** isAdmin: may invite existing users and create invite links. */
  canInvite: boolean;
  /** isAdmin || TEAM_LEADER: may create phantom members. */
  canAddPhantom: boolean;
  onMemberAdded: () => void;
}

// Single entry point for getting a person into the team (existing user / phantom / invite link),
// opened from the "הוסף חבר" button in the team card's members panel.
export function AddMemberModal({ open, onClose, teamId, teamName, token, canInvite, canAddPhantom, onMemberAdded }: AddMemberModalProps) {
  const options: { value: AddMemberTab; label: string }[] = [];
  if (canInvite) options.push({ value: 'existing', label: Strings.teamList.addMemberTabExisting });
  if (canAddPhantom) options.push({ value: 'phantom', label: Strings.teamList.addMemberTabPhantom });
  if (canInvite) options.push({ value: 'link', label: Strings.teamList.addMemberTabLink });

  const [tab, setTab] = useState<AddMemberTab>(options[0]?.value ?? 'existing');
  const activeTab = options.some((o) => o.value === tab) ? tab : options[0]?.value;

  const handleTabChange = (next: AddMemberTab) => {
    trackEvent('add_member_tab_changed', { tab: next });
    setTab(next);
  };

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
      {options.length > 1 && <Segmented value={activeTab} onChange={handleTabChange} options={options} />}
      {activeTab === 'existing' && <AddMemberForm teamId={teamId} token={token} onInviteSent={handleDone} />}
      {activeTab === 'phantom' && <AddPhantomMemberForm teamId={teamId} token={token} onCreated={handleDone} />}
      {activeTab === 'link' && <InviteLinksPanel teamId={teamId} token={token} />}
    </Modal>
  );
}

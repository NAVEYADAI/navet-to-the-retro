import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { CardNative, ButtonNative, FieldNative, MessageNative } from './settings-native-parts';

interface ProfileFormCardNativeProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  profileLoading: boolean;
  profileMessage: { text: string; isError: boolean } | null;
  onUpdateProfile: () => void;
}

export function ProfileFormCardNative(props: ProfileFormCardNativeProps) {
  const t = useTheme();
  const S = Strings.settings;
  return (
    <CardNative title={S.profileCardTitle}>
      {props.profileMessage ? <MessageNative text={props.profileMessage.text} isError={props.profileMessage.isError} /> : null}
      <View style={{ gap: t.space[4] }}>
        <FieldNative label={S.firstNameLabel} value={props.firstName} onChangeText={props.setFirstName} placeholder={S.firstNamePlaceholder} />
        <FieldNative label={S.lastNameLabel} value={props.lastName} onChangeText={props.setLastName} placeholder={S.lastNamePlaceholder} />
        <FieldNative label={S.emailLabel} value={props.email} onChangeText={props.setEmail} placeholder={S.emailPlaceholder} email />
      </View>
      <ButtonNative
        variant="primary"
        loading={props.profileLoading}
        onPress={() => {
          trackEvent('settings_profile_save_clicked');
          props.onUpdateProfile();
        }}
      >
        {S.saveProfileButton}
      </ButtonNative>
    </CardNative>
  );
}

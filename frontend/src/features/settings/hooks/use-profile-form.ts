import { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

export function useProfileForm(user: any, token: string | null | undefined, login: (token: string, user: any) => Promise<void> | void) {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleUpdateProfile = async () => {
    setProfileMessage(null);
    if (!email.trim()) {
      setProfileMessage({ text: 'כתובת אימייל היא שדה חובה.', isError: true });
      return;
    }

    setProfileLoading(true);
    try {
      const response = await axios.patch(
        `${getBackendUrl()}/auth/profile`,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      // Update local auth context user object
      if (token) {
        await login(token, response.data);
      }
      setProfileMessage({ text: 'הפרטים האישיים עודכנו בהצלחה!', isError: false });
    } catch (err: any) {
      setProfileMessage({
        text: err.response?.data?.message || err.message || 'שגיאה בעדכון הפרטים.',
        isError: true,
      });
    } finally {
      setProfileLoading(false);
    }
  };

  return {
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    profileLoading,
    profileMessage,
    handleUpdateProfile,
  };
}

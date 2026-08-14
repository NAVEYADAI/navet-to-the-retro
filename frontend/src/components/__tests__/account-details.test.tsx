import React from 'react';
import { render } from '@testing-library/react-native';
import { AccountDetails } from '../account-details';
import { Strings } from '../../constants/strings';

describe('AccountDetails Component', () => {
  it('renders user details correctly', async () => {
    const user = { username: 'testuser', email: 'test@example.com' };
    const theme = {
      text: '#000',
      background: '#fff',
      backgroundElement: '#fff',
      backgroundSelected: '#ccc',
      textSecondary: '#666',
    };

    const { getByText } = await render(<AccountDetails user={user} theme={theme} />);

    expect(getByText(Strings.dashboard.accountDetailsHeader)).toBeTruthy();
    expect(getByText('testuser')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });
});

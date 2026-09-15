import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { AddPhantomMemberForm } from '../add-phantom-member-form';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTrackEvent = trackEvent as jest.Mock;

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — creation form for a
// real person who refuses to register: first name required, last name optional, no email/username
// entered by the admin (auto-generated server-side).
describe('AddPhantomMemberForm', () => {
  const teamId = 1;
  const token = 'mock-token';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a validation error and never calls the API when first name is empty', async () => {
    const onCreated = jest.fn();
    const { getByText } = await render(
      <AddPhantomMemberForm teamId={teamId} token={token} onCreated={onCreated} />
    );

    await fireEvent.press(getByText(Strings.teamList.addPhantomMemberButton));

    expect(await getByText(Strings.teamList.phantomFirstNameRequiredError)).toBeTruthy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('posts firstName/lastName/role and reports success on submit', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 500, isPhantom: true } });
    const onCreated = jest.fn();

    const { getByText, getByPlaceholderText } = await render(
      <AddPhantomMemberForm teamId={teamId} token={token} onCreated={onCreated} />
    );

    await fireEvent.changeText(getByPlaceholderText(Strings.teamList.phantomFirstNameLabel), 'Phanto');
    await fireEvent.changeText(getByPlaceholderText(Strings.teamList.phantomLastNamePlaceholder), 'Mm');
    await fireEvent.press(getByText(Strings.teamList.addPhantomMemberButton));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/teams/${teamId}/phantom-members`),
        { firstName: 'Phanto', lastName: 'Mm', role: 'DEVELOPER' },
        expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } })
      );
    });

    expect(mockedTrackEvent).toHaveBeenCalledWith('phantom_member_created');
    expect(onCreated).toHaveBeenCalled();
  });

  it('omits lastName when left blank (trimmed to undefined, not an empty string)', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 501, isPhantom: true } });

    const { getByText, getByPlaceholderText } = await render(
      <AddPhantomMemberForm teamId={teamId} token={token} onCreated={jest.fn()} />
    );

    await fireEvent.changeText(getByPlaceholderText(Strings.teamList.phantomFirstNameLabel), '  Phanto  ');
    await fireEvent.press(getByText(Strings.teamList.addPhantomMemberButton));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/teams/${teamId}/phantom-members`),
        { firstName: 'Phanto', lastName: undefined, role: 'DEVELOPER' },
        expect.anything()
      );
    });
  });
});

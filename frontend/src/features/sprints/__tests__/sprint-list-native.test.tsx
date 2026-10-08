import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { TeamSprintsManagerNative } from '../components/sprint-list-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const team = { id: 10, name: 'Core Team' };

const renderList = (isAdmin = true) =>
  render(<TeamSprintsManagerNative team={team} token="tok" isAdmin={isAdmin} onSelectSprint={jest.fn()} />);

describe('TeamSprintsManagerNative (sprint screen bug fixes)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('BUG-34: a failed load shows the error instead of "no sprints yet"; refresh recovers', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const { findByText, queryByText, getByText } = await renderList();

    expect(await findByText(Strings.sprints.loadError)).toBeTruthy();
    expect(queryByText(Strings.sprints.noSprintsTextAdmin)).toBeNull();

    mockedAxios.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Sprint A', startDate: new Date(Date.now() - 86400000).toISOString(), endDate: new Date(Date.now() + 86400000).toISOString() }],
    });
    await fireEvent.press(getByText(Strings.common.refreshButton));
    expect(await findByText('Sprint A')).toBeTruthy();
    expect(queryByText(Strings.sprints.loadError)).toBeNull();
  });

  it('BUG-12: end before start is rejected client-side with a Hebrew error and nothing is posted', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { findByText, getByText, getByPlaceholderText } = await renderList();
    await findByText(Strings.sprints.noSprintsTextAdmin);

    await fireEvent.press(getByText(Strings.sprints.newSprintButton));
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.sprintNamePlaceholder), 'Bad dates');
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.startDateLabel), '2026-10-10');
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.endDateLabel), '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    expect(await findByText(Strings.sprints.endBeforeStartError)).toBeTruthy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('BUG-12: valid dates are posted', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValue({ data: {} });
    const { findByText, getByText, getByPlaceholderText } = await renderList();
    await findByText(Strings.sprints.noSprintsTextAdmin);

    await fireEvent.press(getByText(Strings.sprints.newSprintButton));
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.sprintNamePlaceholder), 'Good dates');
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.startDateLabel), '2026-10-09');
    await fireEvent.changeText(getByPlaceholderText(Strings.sprints.endDateLabel), '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
  });
  const openForm = async (start: string, end: string) => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const utils = await renderList();
    await utils.findByText(Strings.sprints.noSprintsTextAdmin);
    await fireEvent.press(utils.getByText(Strings.sprints.newSprintButton));
    await fireEvent.changeText(utils.getByPlaceholderText(Strings.sprints.sprintNamePlaceholder), 'Sprint X');
    await fireEvent.changeText(utils.getByPlaceholderText(Strings.sprints.startDateLabel), start);
    await fireEvent.changeText(utils.getByPlaceholderText(Strings.sprints.endDateLabel), end);
    return utils;
  };

  it('BUG-15: a malformed date is rejected client-side with a Hebrew error and nothing is posted', async () => {
    const { findByText, getByText } = await openForm('not-a-date', '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    expect(await findByText(Strings.sprints.invalidDateError)).toBeTruthy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('BUG-15: shows the backend 400 message when the server rejects the dates', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'תאריך לא תקין' } } });
    const { findByText, getByText } = await openForm('2026-10-01', '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    expect(await findByText('תאריך לא תקין')).toBeTruthy();
  });

  it('BUG-15: joins an array of backend messages into one line', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: ['שם הספרינט ארוך מדי', 'תאריך לא תקין'] } },
    });
    const { findByText, getByText } = await openForm('2026-10-01', '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    expect(await findByText('שם הספרינט ארוך מדי תאריך לא תקין')).toBeTruthy();
  });

  it('BUG-15: falls back to a generic Hebrew error when the failure carries no message', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const { findByText, getByText } = await openForm('2026-10-01', '2026-10-09');
    await fireEvent.press(getByText(Strings.sprints.openRetroButton));

    expect(await findByText(Strings.sprints.createSprintErrorText)).toBeTruthy();
  });

  it('tracks toggling the create form', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { findByText, getByText } = await renderList();
    await findByText(Strings.sprints.noSprintsTextAdmin);
    await fireEvent.press(getByText(Strings.sprints.newSprintButton));
    expect(trackEvent).toHaveBeenCalledWith('sprint_create_form_toggled', { open: true });
  });
});

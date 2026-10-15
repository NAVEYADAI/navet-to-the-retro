import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import type { OnboardingStatus } from './types';

// Feature 21 endpoints (specs/21-onboarding.md §2). GET only reads; the POSTs upsert the UI-state row.
const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export async function fetchOnboardingStatus(token: string): Promise<OnboardingStatus> {
  const res = await axios.get(`${getBackendUrl()}/onboarding/status`, authed(token));
  return res.data;
}

export async function postDismissChecklist(token: string): Promise<void> {
  await axios.post(`${getBackendUrl()}/onboarding/dismiss-checklist`, {}, authed(token));
}

export async function postRestoreChecklist(token: string): Promise<void> {
  await axios.post(`${getBackendUrl()}/onboarding/restore-checklist`, {}, authed(token));
}

export async function postSeenFeatures(token: string, keys: string[]): Promise<void> {
  await axios.post(`${getBackendUrl()}/onboarding/seen-features`, { keys }, authed(token));
}

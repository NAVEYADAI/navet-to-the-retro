import axios from 'axios';
import { getBackendUrl } from './config';

export const apiClient = axios.create({
  baseURL: getBackendUrl(),
});

export const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

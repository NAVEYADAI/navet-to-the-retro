import { createContext, useContext } from 'react';

/**
 * The session token, exposed through a context of its own (AuthProvider fills it in). Presentational
 * components that only need the token to fetch an authenticated image (TeamLogo, feature 19) read it
 * from here instead of `useAuth()`: it never throws without a provider (isolated component tests,
 * the public invite page) and importing it doesn't drag in `api/client` (and its `axios.create`),
 * which the many tests that `jest.mock('axios')` can't load.
 */
export const SessionTokenContext = createContext<string | null>(null);
export const useSessionToken = (): string | null => useContext(SessionTokenContext);

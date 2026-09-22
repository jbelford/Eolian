import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, type AuthenticatedSession, getAuthSession, logoutSession } from '../api/auth';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'expired' }
  | { status: 'error'; error: ApiError }
  | {
      status: 'authenticated';
      session: AuthenticatedSession;
      isLoggingOut: boolean;
      logoutError?: ApiError;
    };

interface AuthContextValue {
  state: AuthState;
  retry: () => void;
  logout: () => Promise<void>;
  clearLogoutError: () => void;
  handleSessionError: (error: unknown) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    void getAuthSession(controller.signal)
      .then(session => {
        setState(
          session.authenticated
            ? { status: 'authenticated', session, isLoggingOut: false }
            : {
                status: 'unauthenticated',
              },
        );
      })
      .catch(error => {
        if (error instanceof ApiError && error.kind === 'aborted') {
          return;
        }
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          setState({ status: 'expired' });
          return;
        }
        setState({
          status: 'error',
          error:
            error instanceof ApiError
              ? error
              : new ApiError(
                  'Unable to load your session.',
                  'invalid-response',
                  undefined,
                  undefined,
                  {
                    cause: error,
                  },
                ),
        });
      });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (state.status !== 'authenticated') {
      return;
    }

    const delay = Date.parse(state.session.expiresAt) - Date.now();
    if (delay <= 0) {
      setState({ status: 'expired' });
      return;
    }

    const timeout = window.setTimeout(
      () => setState({ status: 'expired' }),
      Math.min(delay, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [state]);

  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  const logout = useCallback(async () => {
    if (state.status !== 'authenticated' || state.isLoggingOut) {
      return;
    }

    const { session } = state;
    setState({ status: 'authenticated', session, isLoggingOut: true });

    try {
      await logoutSession(session.csrfToken);
      setState({ status: 'unauthenticated' });
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'unauthorized') {
        setState({ status: 'expired' });
        return;
      }
      setState({
        status: 'authenticated',
        session,
        isLoggingOut: false,
        logoutError:
          error instanceof ApiError
            ? error
            : new ApiError('Unable to sign out.', 'invalid-response', undefined, undefined, {
                cause: error,
              }),
      });
    }
  }, [state]);

  const clearLogoutError = useCallback(() => {
    setState(current =>
      current.status === 'authenticated' ? { ...current, logoutError: undefined } : current,
    );
  }, []);

  const handleSessionError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.kind === 'unauthorized') {
      setState({ status: 'expired' });
      return true;
    }
    return false;
  }, []);

  const value = useMemo(
    () => ({ state, retry, logout, clearLogoutError, handleSessionError }),
    [clearLogoutError, handleSessionError, logout, retry, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

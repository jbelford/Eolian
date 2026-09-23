import { Alert, Button, Spinner } from '@heroui/react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { discordLoginUrl, safeReturnPath } from '../api/auth';
import { BrandMark } from '../components/brand';
import { useAuth } from './auth-context';

const centeredShell = 'grid min-h-dvh place-items-center bg-background px-5 py-16 text-foreground';

export const AuthLoading = () => (
  <main className={centeredShell} aria-busy="true" aria-live="polite">
    <div className="flex flex-col items-center gap-4 text-center">
      <Spinner color="accent" size="lg" />
      <div>
        <h1 className="font-display text-2xl font-bold">Loading your workspace</h1>
        <p className="mt-2 text-muted">Checking your Discord session.</p>
      </div>
    </div>
  </main>
);

interface SignInPanelProps {
  returnTo: string;
  expired?: boolean;
}

const SignInPanel = ({ returnTo, expired = false }: SignInPanelProps) => (
  <div className="w-full max-w-md rounded-[2rem] border border-separator bg-surface p-7 shadow-sm sm:p-10">
    <BrandMark />
    <h1 className="font-display mt-8 text-3xl font-bold tracking-[-0.04em]">
      {expired ? 'Your session has expired' : 'Sign in to Eolian'}
    </h1>
    <p className="mt-4 leading-7 text-muted">
      {expired
        ? 'Sign in with Discord again to continue managing your servers.'
        : 'Use Discord to open your account and the servers you can manage.'}
    </p>
    <a
      className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus"
      href={discordLoginUrl(returnTo)}
    >
      Continue with Discord
    </a>
    <a
      className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 font-semibold text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      href="/"
    >
      Return to the public site
    </a>
  </div>
);

export const SignInPage = () => {
  const { state } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));

  if (state.status === 'authenticated') {
    return <Navigate replace to={returnTo} />;
  }

  return (
    <div className={centeredShell}>
      <SignInPanel expired={state.status === 'expired'} returnTo={returnTo} />
    </div>
  );
};

export const ProtectedRoute = () => {
  const { state, retry } = useAuth();
  const location = useLocation();
  const returnTo = safeReturnPath(`${location.pathname}${location.search}${location.hash}`);

  if (state.status === 'loading') {
    return <AuthLoading />;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate replace to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />;
  }

  if (state.status === 'expired') {
    return (
      <main className={centeredShell}>
        <SignInPanel expired returnTo={returnTo} />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className={centeredShell}>
        <Alert className="w-full max-w-xl" role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>We could not load your workspace</Alert.Title>
            <Alert.Description>{state.error.message}</Alert.Description>
          </Alert.Content>
          <Button variant="danger" onPress={retry}>
            Try again
          </Button>
        </Alert>
      </main>
    );
  }

  return <Outlet />;
};

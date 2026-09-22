import { Alert, Button, Card, Chip, Spinner } from '@heroui/react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  getAccountSettings,
  startProviderLink,
  type AccountSettings,
  type ProviderName,
  type SyntaxPreference,
  unlinkProvider,
  updateAccountSyntax,
} from '../api/settings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';

const providerLabels: Record<ProviderName, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
};

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'The request could not be completed.';

export const AccountSettingsPage = () => {
  const { state, handleSessionError } = useAuth();
  const [settings, setSettings] = useState<AccountSettings>();
  const [syntax, setSyntax] = useState<SyntaxPreference | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [feedback, setFeedback] = useState<{ status: 'success' | 'danger'; message: string }>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [confirmProvider, setConfirmProvider] = useState<ProviderName>();
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoadError(undefined);
      return getAccountSettings(signal)
        .then(next => {
          setSettings(next);
          setSyntax(next.syntax);
        })
        .catch(error => {
          if (error instanceof ApiError && error.kind === 'aborted') return;
          if (handleSessionError(error)) return;
          setLoadError(errorMessage(error));
        });
    },
    [handleSessionError],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  if (state.status !== 'authenticated') return null;

  const { csrfToken } = state.session;
  const isDirty = settings !== undefined && syntax !== settings.syntax;

  const saveSyntax = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !isDirty || pendingAction) return;
    setPendingAction('syntax');
    setFeedback(undefined);
    try {
      const next = await updateAccountSyntax(syntax, csrfToken);
      setSettings(next);
      setSyntax(next.syntax);
      setFeedback({ status: 'success', message: 'Your command syntax preference was saved.' });
    } catch (error) {
      if (!handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      setPendingAction(undefined);
    }
  };

  const linkProvider = async (provider: ProviderName) => {
    setPendingAction(`link-${provider}`);
    setFeedback(undefined);
    try {
      const { authorizationUrl } = await startProviderLink(provider, csrfToken);
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setFeedback({
        status: 'success',
        message: `Finish linking ${providerLabels[provider]} in the new tab, then refresh the connection status.`,
      });
    } catch (error) {
      if (!handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      setPendingAction(undefined);
    }
  };

  const removeProvider = async (provider: ProviderName) => {
    setPendingAction(`unlink-${provider}`);
    setFeedback(undefined);
    try {
      await unlinkProvider(provider, csrfToken);
      setSettings(current =>
        current
          ? {
              ...current,
              providers: {
                ...current.providers,
                [provider]: { ...current.providers[provider], linked: false },
              },
            }
          : current,
      );
      setConfirmProvider(undefined);
      setFeedback({
        status: 'success',
        message: `${providerLabels[provider]} was disconnected.`,
      });
    } catch (error) {
      if (!handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      setPendingAction(undefined);
    }
  };

  if (!settings && !loadError) {
    return (
      <div className="mt-10 flex items-center gap-3 text-muted" aria-live="polite">
        <Spinner size="sm" />
        Loading account settings…
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert className="mt-10 max-w-3xl" role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Account settings could not be loaded</Alert.Title>
          <Alert.Description>{loadError}</Alert.Description>
        </Alert.Content>
        <Button variant="danger" onPress={() => setReloadKey(key => key + 1)}>
          Try again
        </Button>
      </Alert>
    );
  }

  return (
    <div className="mt-10 grid max-w-4xl gap-6">
      {feedback && (
        <Alert role="status" status={feedback.status}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{feedback.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <Card.Title>Command syntax</Card.Title>
          <Card.Description>
            Choose how your personal commands are parsed. Inherit uses each server’s setting.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="grid gap-5" onSubmit={event => void saveSyntax(event)}>
            <fieldset disabled={pendingAction === 'syntax'}>
              <legend className="text-sm font-semibold">Personal syntax preference</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ['inherit', null, 'Inherit', 'Use the server or default syntax.'],
                  ['keyword', 'keyword', 'Keyword', 'Natural language-style command options.'],
                  ['traditional', 'traditional', 'Traditional', 'Flag-based command options.'],
                ].map(([id, value, label, description]) => (
                  <label
                    className="flex cursor-pointer gap-3 rounded-2xl border border-separator bg-background p-4 has-[:checked]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
                    key={id}
                  >
                    <input
                      checked={syntax === value}
                      className="mt-1 accent-[var(--accent)]"
                      name="account-syntax"
                      type="radio"
                      onChange={() => setSyntax(value as SyntaxPreference | null)}
                    />
                    <span>
                      <span className="block font-semibold">{label}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <Button isDisabled={!isDirty || Boolean(pendingAction)} type="submit">
                {pendingAction === 'syntax' ? 'Saving…' : 'Save preference'}
              </Button>
              <Button
                isDisabled={!isDirty || Boolean(pendingAction)}
                type="button"
                variant="secondary"
                onPress={() => setSyntax(settings.syntax)}
              >
                Reset changes
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex-row items-start justify-between gap-4">
          <div>
            <Card.Title>Music providers</Card.Title>
            <Card.Description>
              Link an account to use personal playlists, likes, and provider libraries.
            </Card.Description>
          </div>
          <Button
            isDisabled={Boolean(pendingAction)}
            size="sm"
            variant="secondary"
            onPress={() => setReloadKey(key => key + 1)}
          >
            Refresh status
          </Button>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(providerLabels) as ProviderName[]).map(provider => {
              const status = settings.providers[provider];
              const isPending = pendingAction?.endsWith(provider);
              return (
                <section
                  aria-labelledby={`${provider}-heading`}
                  className="rounded-2xl border border-separator bg-background p-5"
                  key={provider}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-bold" id={`${provider}-heading`}>
                        {providerLabels[provider]}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {status.linked
                          ? 'Connected to your Eolian account.'
                          : status.linkAvailable
                            ? 'Available to connect.'
                            : 'Linking is not enabled for this deployment.'}
                      </p>
                    </div>
                    <Chip color={status.linked ? 'success' : 'default'} variant="soft">
                      {status.linked ? 'Linked' : 'Not linked'}
                    </Chip>
                  </div>

                  {confirmProvider === provider ? (
                    <div className="mt-5 rounded-xl border border-danger/40 p-4" role="group">
                      <p className="text-sm font-semibold">
                        Disconnect {providerLabels[provider]}?
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Provider playlists and likes will be unavailable until you link again.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          isDisabled={isPending}
                          size="sm"
                          variant="danger"
                          onPress={() => void removeProvider(provider)}
                        >
                          {isPending ? 'Disconnecting…' : 'Confirm disconnect'}
                        </Button>
                        <Button
                          isDisabled={isPending}
                          size="sm"
                          variant="tertiary"
                          onPress={() => setConfirmProvider(undefined)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      {status.linked ? (
                        <Button
                          isDisabled={Boolean(pendingAction)}
                          size="sm"
                          variant="danger"
                          onPress={() => setConfirmProvider(provider)}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          isDisabled={!status.linkAvailable || Boolean(pendingAction)}
                          size="sm"
                          onPress={() => void linkProvider(provider)}
                        >
                          {isPending ? 'Opening…' : `Link ${providerLabels[provider]}`}
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

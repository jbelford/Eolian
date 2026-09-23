import { Alert, Button, Card, Chip, Link, Spinner } from '@heroui/react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
  const [authorizationUrls, setAuthorizationUrls] = useState<Partial<Record<ProviderName, string>>>(
    {},
  );
  const [reloadKey, setReloadKey] = useState(0);
  const mutationController = useRef<AbortController | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoadError(undefined);
      return getAccountSettings(signal)
        .then(next => {
          if (signal?.aborted) return;
          setSettings(next);
          setSyntax(next.syntax);
          setAuthorizationUrls({});
        })
        .catch(error => {
          if (signal?.aborted || (error instanceof ApiError && error.kind === 'aborted')) return;
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

  useEffect(
    () => () => {
      mutationController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (feedback?.status === 'danger') feedbackRef.current?.focus();
  }, [feedback]);

  if (state.status !== 'authenticated') return null;

  const { csrfToken } = state.session;
  const isDirty = settings !== undefined && syntax !== settings.syntax;

  const saveSyntax = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !isDirty || pendingAction) return;
    const controller = new AbortController();
    mutationController.current = controller;
    setPendingAction('syntax');
    setFeedback(undefined);
    try {
      const next = await updateAccountSyntax(syntax, csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      setSettings(next);
      setSyntax(next.syntax);
      setFeedback({ status: 'success', message: 'Command style saved.' });
    } catch (error) {
      if (!controller.signal.aborted && !handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      if (!controller.signal.aborted) setPendingAction(undefined);
    }
  };

  const linkProvider = async (provider: ProviderName) => {
    if (pendingAction) return;
    const controller = new AbortController();
    mutationController.current = controller;
    setPendingAction(`link-${provider}`);
    setFeedback(undefined);
    try {
      const { authorizationUrl } = await startProviderLink(provider, csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      setAuthorizationUrls(current => ({ ...current, [provider]: authorizationUrl }));
      setFeedback({
        status: 'success',
        message: `Ready to link ${providerLabels[provider]}. Open the link below in a new tab, then refresh the status when you’re done.`,
      });
    } catch (error) {
      if (!controller.signal.aborted && !handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      if (!controller.signal.aborted) setPendingAction(undefined);
    }
  };

  const removeProvider = async (provider: ProviderName) => {
    if (pendingAction) return;
    const controller = new AbortController();
    mutationController.current = controller;
    setPendingAction(`unlink-${provider}`);
    setFeedback(undefined);
    try {
      await unlinkProvider(provider, csrfToken, controller.signal);
      if (controller.signal.aborted) return;
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
        message: `${providerLabels[provider]} disconnected.`,
      });
    } catch (error) {
      if (!controller.signal.aborted && !handleSessionError(error)) {
        setFeedback({ status: 'danger', message: errorMessage(error) });
      }
    } finally {
      if (!controller.signal.aborted) setPendingAction(undefined);
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
        <Alert
          ref={feedbackRef}
          role={feedback.status === 'danger' ? 'alert' : 'status'}
          status={feedback.status}
          tabIndex={feedback.status === 'danger' ? -1 : undefined}
        >
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
            Pick how you write commands. Inherit uses the server’s setting.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="grid gap-5" onSubmit={event => void saveSyntax(event)}>
            <fieldset disabled={pendingAction === 'syntax'}>
              <legend className="text-sm font-semibold">Your command style</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ['inherit', null, 'Inherit', 'Use the server’s command style.'],
                  ['keyword', 'keyword', 'Keyword', 'Write options as words.'],
                  ['traditional', 'traditional', 'Traditional', 'Use flags for options.'],
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
              Link Spotify or SoundCloud to add your own playlists and likes. Spotify also supports
              your top tracks.
            </Card.Description>
          </div>
          <Button
            isDisabled={Boolean(pendingAction)}
            size="sm"
            variant="secondary"
            onPress={() => {
              setFeedback(undefined);
              setReloadKey(key => key + 1);
            }}
          >
            Refresh status
          </Button>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(providerLabels) as ProviderName[]).map(provider => {
              const status = settings.providers[provider];
              const isPending = pendingAction?.endsWith(provider);
              const authorizationUrl = authorizationUrls[provider];
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
                          ? 'Linked to Eolian.'
                          : status.linkAvailable
                            ? 'Not linked yet.'
                            : 'Account linking is not available here.'}
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
                        You won’t be able to add your playlists or likes from this account until you
                        link it again.
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
                        <div className="grid justify-items-start gap-3">
                          <Button
                            isDisabled={!status.linkAvailable || Boolean(pendingAction)}
                            size="sm"
                            onPress={() => void linkProvider(provider)}
                          >
                            {isPending
                              ? 'Preparing…'
                              : authorizationUrl
                                ? `Restart ${providerLabels[provider]} link`
                                : `Link ${providerLabels[provider]}`}
                          </Button>
                          {authorizationUrl && (
                            <div className="grid gap-2">
                              <Link
                                className="font-semibold"
                                href={authorizationUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Continue linking {providerLabels[provider]}
                              </Link>
                              <p className="text-sm leading-6 text-muted">
                                Finish linking in the new tab, then come back and choose Refresh
                                status.
                              </p>
                            </div>
                          )}
                        </div>
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

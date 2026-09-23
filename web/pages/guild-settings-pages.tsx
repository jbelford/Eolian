import { Alert, Avatar, Button, Card, Chip, Spinner } from '@heroui/react';
import { UsersRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  getGuild,
  getGuilds,
  type GuildDetail,
  type GuildSettings,
  type GuildSettingsUpdate,
  type GuildSummary,
  updateGuild,
} from '../api/settings';
import { useAuth } from '../auth/auth-context';

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'The request could not be completed.';

const guildIconUrl = (guild: GuildSummary) =>
  guild.icon
    ? guild.icon.startsWith('http')
      ? guild.icon
      : `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=96`
    : undefined;

const GuildAvatar = ({ guild }: { guild: GuildSummary }) => (
  <Avatar>
    <Avatar.Image alt="" src={guildIconUrl(guild)} />
    <Avatar.Fallback>
      <UsersRound aria-hidden="true" className="size-5" />
    </Avatar.Fallback>
  </Avatar>
);

export const GuildsSettingsPage = () => {
  const { handleSessionError } = useAuth();
  const [guilds, setGuilds] = useState<GuildSummary[]>();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<ApiError>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    void getGuilds(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setGuilds(result.guilds);
      })
      .catch(caught => {
        if (
          controller.signal.aborted ||
          (caught instanceof ApiError && caught.kind === 'aborted')
        ) {
          return;
        }
        if (handleSessionError(caught)) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError('The server list could not be loaded.', 'invalid-response'),
        );
      });
    return () => controller.abort();
  }, [handleSessionError, reloadKey]);

  const filteredGuilds = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return guilds?.filter(guild => guild.name.toLocaleLowerCase().includes(normalized)) ?? [];
  }, [guilds, query]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-4xl font-bold tracking-[-0.04em]">Servers</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
        Choose a shared Discord server where you have permission to manage Eolian.
      </p>

      {!guilds && !error && (
        <div className="mt-10 flex items-center gap-3 text-muted" aria-live="polite">
          <Spinner size="sm" />
          Loading servers…
        </div>
      )}

      {error && (
        <Alert className="mt-10 max-w-3xl" role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {error.code === 'bot_not_ready'
                ? 'Eolian is still starting'
                : 'Servers could not be loaded'}
            </Alert.Title>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
          <Button variant="danger" onPress={() => setReloadKey(key => key + 1)}>
            Try again
          </Button>
        </Alert>
      )}

      {guilds && guilds.length === 0 && (
        <Card className="mt-10 max-w-3xl">
          <Card.Header>
            <Card.Title>No shared manageable servers</Card.Title>
            <Card.Description>
              Eolian is not currently in a server that your Discord account can manage.
            </Card.Description>
          </Card.Header>
        </Card>
      )}

      {guilds && guilds.length > 0 && (
        <div className="mt-8">
          <label className="block max-w-xl">
            <span className="text-sm font-semibold">Search servers</span>
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-separator bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              placeholder="Search by server name"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </label>

          {filteredGuilds.length === 0 ? (
            <p className="mt-8 text-muted" role="status">
              No servers match “{query}”.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredGuilds.map(guild => (
                <li key={guild.id}>
                  <Link
                    className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    to={`/app/guilds/${guild.id}`}
                  >
                    <Card className="h-full transition-transform hover:-translate-y-0.5">
                      <Card.Header className="flex-row items-center">
                        <GuildAvatar guild={guild} />
                        <div>
                          <Card.Title>{guild.name}</Card.Title>
                          <Card.Description>Open server settings</Card.Description>
                        </div>
                      </Card.Header>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

interface GuildDraft {
  prefix: string;
  volumePercent: string;
  syntax: GuildSettings['syntax'];
  preferredChannelId: string;
  djRoleIds: string[];
  djAllowLimited: boolean;
}

const draftFromGuild = (guild: GuildDetail): GuildDraft => ({
  prefix: guild.settings.prefix,
  volumePercent: String(Math.round(guild.settings.volume * 100)),
  syntax: guild.settings.syntax,
  preferredChannelId: guild.settings.preferredChannelId ?? '',
  djRoleIds: [...guild.settings.djRoleIds],
  djAllowLimited: guild.settings.djAllowLimited,
});

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

const parseVolumePercent = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
};

const updateFromDraft = (draft: GuildDraft, baseline: GuildDetail): GuildSettingsUpdate => {
  const update: GuildSettingsUpdate = {};
  const volumePercent = parseVolumePercent(draft.volumePercent);
  if (draft.prefix !== baseline.settings.prefix) update.prefix = draft.prefix;
  if (volumePercent !== undefined && volumePercent / 100 !== baseline.settings.volume) {
    update.volume = volumePercent / 100;
  }
  if (draft.syntax !== baseline.settings.syntax) update.syntax = draft.syntax;
  if ((draft.preferredChannelId || null) !== baseline.settings.preferredChannelId) {
    update.preferredChannelId = draft.preferredChannelId || null;
  }
  if (!sameIds(draft.djRoleIds, baseline.settings.djRoleIds)) {
    update.djRoleIds = draft.djRoleIds;
  }
  if (draft.djAllowLimited !== baseline.settings.djAllowLimited) {
    update.djAllowLimited = draft.djAllowLimited;
  }
  return update;
};

const detailErrorTitle = (error: ApiError) => {
  if (error.kind === 'forbidden') return 'You cannot manage this server';
  if (error.code === 'bot_not_in_guild') return 'Eolian is no longer in this server';
  if (error.code === 'bot_not_ready') return 'Eolian is still starting';
  if (error.kind === 'not-found') return 'Server not found';
  return 'Server settings could not be loaded';
};

export const GuildSettingsPage = () => {
  const { guildId } = useParams();
  const { state, handleSessionError } = useAuth();
  const [guild, setGuild] = useState<GuildDetail>();
  const [draft, setDraft] = useState<GuildDraft>();
  const [loadError, setLoadError] = useState<ApiError>();
  const [formError, setFormError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const saveController = useRef<AbortController | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal, preserveDraft = false) => {
      if (!guildId) return;
      setLoadError(undefined);
      try {
        const next = await getGuild(guildId, signal);
        if (signal?.aborted) return;
        setGuild(next);
        if (!preserveDraft) setDraft(draftFromGuild(next));
      } catch (error) {
        if (signal?.aborted || (error instanceof ApiError && error.kind === 'aborted')) return;
        if (handleSessionError(error)) return;
        setLoadError(
          error instanceof ApiError
            ? error
            : new ApiError('Server settings could not be loaded.', 'invalid-response'),
        );
      }
    },
    [guildId, handleSessionError],
  );

  useEffect(() => {
    const controller = new AbortController();
    setGuild(undefined);
    setDraft(undefined);
    void load(controller.signal);
    return () => {
      controller.abort();
      saveController.current?.abort();
    };
  }, [load, reloadKey]);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  if (state.status !== 'authenticated') return null;

  if (!guild || !draft) {
    return (
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {!loadError ? (
          <div className="flex items-center gap-3 text-muted" aria-live="polite">
            <Spinner size="sm" />
            Loading server settings…
          </div>
        ) : (
          <Alert className="max-w-3xl" role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{detailErrorTitle(loadError)}</Alert.Title>
              <Alert.Description>{loadError.message}</Alert.Description>
            </Alert.Content>
            <Button variant="danger" onPress={() => setReloadKey(key => key + 1)}>
              Try again
            </Button>
          </Alert>
        )}
      </section>
    );
  }

  const update = updateFromDraft(draft, guild);
  const isDirty = Object.keys(update).length > 0;
  const volumePercent = parseVolumePercent(draft.volumePercent);
  const prefixError =
    Array.from(draft.prefix).length !== 1 ? 'Enter exactly one Unicode character.' : undefined;
  const volumeError = volumePercent === undefined ? 'Enter a volume from 0 to 100.' : undefined;
  const roleIds = new Set(guild.roles.map(role => role.id));
  const staleRoles = draft.djRoleIds.filter(id => !roleIds.has(id));
  const channelIds = new Set(guild.channels.map(channel => channel.id));
  const staleChannel =
    draft.preferredChannelId && !channelIds.has(draft.preferredChannelId)
      ? draft.preferredChannelId
      : undefined;

  const toggleRole = (roleId: string, selected: boolean) => {
    setDraft(current => {
      if (!current) return current;
      return {
        ...current,
        djRoleIds: selected
          ? [...current.djRoleIds, roleId]
          : current.djRoleIds.filter(id => id !== roleId),
      };
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!guildId || !isDirty || prefixError || volumeError || isSaving) return;
    const controller = new AbortController();
    saveController.current = controller;
    setIsSaving(true);
    setFormError(undefined);
    setFeedback(undefined);
    try {
      const next = await updateGuild(guildId, update, state.session.csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      setGuild(next);
      setDraft(draftFromGuild(next));
      setFeedback('Server settings were saved.');
    } catch (error) {
      if (controller.signal.aborted || handleSessionError(error)) return;
      if (
        error instanceof ApiError &&
        (error.code === 'channel_not_found' || error.code === 'role_not_found')
      ) {
        setFormError(
          `${error.message} The available options were refreshed; review and try again.`,
        );
        await load(controller.signal, true);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      if (!controller.signal.aborted) setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-4">
        <GuildAvatar guild={guild} />
        <div>
          <p className="text-sm font-semibold text-accent">Server settings</p>
          <h1 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            {guild.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{guild.memberCount} members</p>
        </div>
      </div>

      <form className="mt-10 grid max-w-4xl gap-6" onSubmit={event => void save(event)}>
        {feedback && (
          <Alert role="status" status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{feedback}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {formError && (
          <Alert ref={formErrorRef} role="alert" status="danger" tabIndex={-1}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Settings were not saved</Alert.Title>
              <Alert.Description>{formError}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {(staleChannel || staleRoles.length > 0) && (
          <Alert role="status" status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Some saved Discord options are unavailable</Alert.Title>
              <Alert.Description>
                Clear the unavailable channel or roles before saving related changes.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Card>
          <Card.Header>
            <Card.Title>Commands and playback defaults</Card.Title>
            <Card.Description>
              Configure command parsing, prefix, and the default player volume.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-6 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Command prefix</span>
              <input
                aria-describedby="prefix-description prefix-error"
                aria-invalid={Boolean(prefixError)}
                className="mt-2 min-h-11 w-full rounded-xl border border-separator bg-background px-4 text-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
                disabled={isSaving}
                value={draft.prefix}
                onChange={event =>
                  setDraft(current => current && { ...current, prefix: event.target.value })
                }
              />
              <span className="mt-2 block text-sm text-muted" id="prefix-description">
                The one-Unicode-character prefix used for traditional message commands.
              </span>
              {prefixError && (
                <span className="mt-1 block text-sm text-danger" id="prefix-error" role="alert">
                  {prefixError}
                </span>
              )}
            </label>

            <label>
              <span className="text-sm font-semibold">Default volume: {draft.volumePercent}%</span>
              <input
                aria-describedby="volume-description volume-error"
                aria-invalid={Boolean(volumeError)}
                className="mt-3 w-full accent-[var(--accent)]"
                disabled={isSaving}
                max="100"
                min="0"
                type="range"
                value={draft.volumePercent}
                onChange={event =>
                  setDraft(current => current && { ...current, volumePercent: event.target.value })
                }
              />
              <input
                aria-label="Default volume percentage"
                className="mt-2 min-h-11 w-28 rounded-xl border border-separator bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                disabled={isSaving}
                inputMode="decimal"
                type="text"
                value={draft.volumePercent}
                onChange={event =>
                  setDraft(current => current && { ...current, volumePercent: event.target.value })
                }
              />
              <span className="mt-2 block text-sm text-muted" id="volume-description">
                Displayed as 0–100%; saved as the API’s 0–1 volume value.
              </span>
              {volumeError && (
                <span className="mt-1 block text-sm text-danger" id="volume-error" role="alert">
                  {volumeError}
                </span>
              )}
            </label>

            <fieldset className="sm:col-span-2" disabled={isSaving}>
              <legend className="text-sm font-semibold">Server command syntax</legend>
              <div className="mt-3 flex flex-wrap gap-4">
                {(['keyword', 'traditional'] as const).map(value => (
                  <label className="flex min-h-11 items-center gap-2" key={value}>
                    <input
                      checked={draft.syntax === value}
                      className="accent-[var(--accent)]"
                      name="guild-syntax"
                      type="radio"
                      onChange={() => setDraft(current => current && { ...current, syntax: value })}
                    />
                    <span className="capitalize">{value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Announcements and DJ access</Card.Title>
            <Card.Description>
              Choose an optional text channel and up to ten roles that receive DJ permissions.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-7">
            <label>
              <span className="text-sm font-semibold">Preferred text channel</span>
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-separator bg-background px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                disabled={isSaving}
                value={draft.preferredChannelId}
                onChange={event =>
                  setDraft(
                    current => current && { ...current, preferredChannelId: event.target.value },
                  )
                }
              >
                <option value="">No preferred channel</option>
                {staleChannel && (
                  <option value={staleChannel}>Unavailable channel ({staleChannel})</option>
                )}
                {guild.channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-sm text-muted">
                Eolian uses this channel for server announcements when configured.
              </span>
            </label>

            <fieldset disabled={isSaving}>
              <legend className="text-sm font-semibold">DJ roles</legend>
              <p className="mt-1 text-sm text-muted">
                {draft.djRoleIds.length} of 10 roles selected.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {staleRoles.map(roleId => (
                  <label
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-warning/50 px-4"
                    key={roleId}
                  >
                    <input
                      checked
                      className="accent-[var(--accent)]"
                      type="checkbox"
                      onChange={event => toggleRole(roleId, event.target.checked)}
                    />
                    Unavailable role ({roleId})
                  </label>
                ))}
                {guild.roles.map(role => {
                  const checked = draft.djRoleIds.includes(role.id);
                  return (
                    <label
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-separator px-4 has-[:checked]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
                      key={role.id}
                    >
                      <input
                        checked={checked}
                        className="accent-[var(--accent)]"
                        disabled={!checked && draft.djRoleIds.length >= 10}
                        type="checkbox"
                        onChange={event => toggleRole(role.id, event.target.checked)}
                      />
                      {role.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="flex gap-3 rounded-2xl border border-separator p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus">
              <input
                checked={draft.djAllowLimited}
                className="mt-1 accent-[var(--accent)]"
                disabled={isSaving}
                type="checkbox"
                onChange={event =>
                  setDraft(
                    current => current && { ...current, djAllowLimited: event.target.checked },
                  )
                }
              />
              <span>
                <span className="block font-semibold">Allow limited DJ mode</span>
                <span className="mt-1 block text-sm leading-6 text-muted">
                  Let members use the limited set of DJ actions when no configured DJ is present.
                </span>
              </span>
            </label>
          </Card.Content>
        </Card>

        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-separator bg-background/95 p-4 shadow-lg backdrop-blur">
          <Button
            isDisabled={!isDirty || Boolean(prefixError) || Boolean(volumeError) || isSaving}
            type="submit"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            isDisabled={!isDirty || isSaving}
            type="button"
            variant="secondary"
            onPress={() => {
              setDraft(draftFromGuild(guild));
              setFormError(undefined);
            }}
          >
            Reset changes
          </Button>
          <Chip color={isDirty ? 'warning' : 'success'} variant="soft">
            {isDirty ? 'Unsaved changes' : 'Up to date'}
          </Chip>
        </div>
      </form>
    </section>
  );
};

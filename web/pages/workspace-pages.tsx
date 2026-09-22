import { Avatar, Card, Chip } from '@heroui/react';
import { Sparkles, UsersRound } from 'lucide-react';
import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { discordGuildIconUrl, type AuthGuild, type AuthUser } from '../api/auth';
import { useAuth } from '../auth/auth-context';

const pageClass = 'mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14';

export interface GuildRouteContext {
  guild: AuthGuild;
}

export interface AccountRouteContext {
  user: AuthUser;
}

const useAuthenticatedSession = () => {
  const { state } = useAuth();

  if (state.status !== 'authenticated') {
    throw new Error('Workspace pages require an authenticated session.');
  }

  return state.session;
};

export const WorkspaceOverviewPage = () => {
  const session = useAuthenticatedSession();
  const displayName = session.user.globalName ?? session.user.username;

  return (
    <section className={pageClass}>
      <Chip color="accent" variant="soft">
        <Sparkles aria-hidden="true" className="size-4" />
        Discord connected
      </Chip>
      <h1 className="font-display mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
        Welcome back, {displayName}.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
        Choose a server you manage to continue. Server settings arrive in the next stacked change.
      </p>

      {session.guilds.length === 0 ? (
        <Card className="mt-10 max-w-2xl">
          <Card.Header>
            <Card.Title>No manageable servers found</Card.Title>
            <Card.Description>
              Discord did not return any servers where you are the owner or have permission to
              manage the server.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <a
              className="font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
              href="https://discord.com/channels/@me"
              rel="noreferrer"
              target="_blank"
            >
              Open Discord
            </a>
          </Card.Content>
        </Card>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {session.guilds.map(guild => (
            <Link
              className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
              key={guild.id}
              to={`/app/guilds/${guild.id}`}
            >
              <Card className="h-full transition-transform hover:-translate-y-0.5">
                <Card.Header className="flex-row items-center">
                  <Avatar>
                    <Avatar.Image alt="" src={discordGuildIconUrl(guild)} />
                    <Avatar.Fallback>
                      <UsersRound aria-hidden="true" className="size-5" />
                    </Avatar.Fallback>
                  </Avatar>
                  <div>
                    <Card.Title>{guild.name}</Card.Title>
                    <Card.Description>
                      {guild.owner ? 'Server owner' : 'Can manage server'}
                    </Card.Description>
                  </div>
                </Card.Header>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export const GuildsPage = () => {
  const session = useAuthenticatedSession();

  return (
    <section className={pageClass}>
      <h1 className="font-display text-4xl font-bold tracking-[-0.04em]">Servers</h1>
      {session.guilds.length === 0 ? (
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          You do not currently have any Discord servers that you can manage.
        </p>
      ) : (
        <>
          <p className="mt-4 text-lg text-muted">Choose a server from the navigation.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {session.guilds.map(guild => (
              <li key={guild.id}>
                <Link
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-separator bg-surface px-4 font-semibold outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                  to={`/app/guilds/${guild.id}`}
                >
                  <Avatar size="sm">
                    <Avatar.Image alt="" src={discordGuildIconUrl(guild)} />
                    <Avatar.Fallback>
                      <UsersRound aria-hidden="true" className="size-4" />
                    </Avatar.Fallback>
                  </Avatar>
                  {guild.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export const GuildRouteLayout = () => {
  const session = useAuthenticatedSession();
  const { guildId } = useParams();
  const guild = session.guilds.find(candidate => candidate.id === guildId);

  if (!guild) {
    return <Navigate replace to="/app/guilds" />;
  }

  return (
    <section className={pageClass}>
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <Avatar.Image alt="" src={discordGuildIconUrl(guild)} />
          <Avatar.Fallback>
            <UsersRound aria-hidden="true" className="size-6" />
          </Avatar.Fallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-accent">Server</p>
          <h1 className="font-display text-4xl font-bold tracking-[-0.04em]">{guild.name}</h1>
        </div>
      </div>
      <Outlet context={{ guild } satisfies GuildRouteContext} />
    </section>
  );
};

export const GuildOverviewPage = () => (
  <Card className="mt-10 max-w-3xl">
    <Card.Header>
      <Card.Title>Server settings are ready for B3</Card.Title>
      <Card.Description>
        This authenticated route and selected server context are ready for the settings forms and
        API integration in the next change.
      </Card.Description>
    </Card.Header>
  </Card>
);

export const AccountRouteLayout = () => {
  const session = useAuthenticatedSession();
  const displayName = session.user.globalName ?? session.user.username;

  return (
    <section className={pageClass}>
      <p className="text-sm font-semibold text-accent">Discord account</p>
      <h1 className="font-display mt-2 text-4xl font-bold tracking-[-0.04em]">{displayName}</h1>
      <p className="mt-2 text-muted">@{session.user.username}</p>
      <Outlet context={{ user: session.user } satisfies AccountRouteContext} />
    </section>
  );
};

export const AccountOverviewPage = () => (
  <Card className="mt-10 max-w-3xl">
    <Card.Header>
      <Card.Title>Account connections are ready for B3</Card.Title>
      <Card.Description>
        This route intentionally does not read or update settings until those endpoints are
        available.
      </Card.Description>
    </Card.Header>
  </Card>
);

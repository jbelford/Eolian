import { Card, Chip } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import {
  ArrowUpRight,
  Command,
  Headphones,
  ListMusic,
  Music2,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import logoUrl from '../assets/eolian-logo.png';
import { discordInviteUrl } from '../config/discord-invite';
import { discordLoginUrl } from '../api/auth';

const features = [
  {
    icon: ListMusic,
    title: 'Add more than one song',
    description:
      'Queue songs, albums, playlists, or an artist’s tracks. Link accounts for likes and Spotify top tracks.',
    detail: 'Spotify, SoundCloud, and YouTube',
  },
  {
    icon: Command,
    title: 'Your choice of commands',
    description:
      'Type keywords, use flags, or pick a slash command. They all work with the same queue.',
    detail: 'Keywords, flags, and slash commands',
  },
  {
    icon: Headphones,
    title: 'Keep the music playing',
    description:
      'Skip a track, shuffle the queue, loop a favorite, or change the volume with commands and Discord buttons.',
    detail: 'Player and queue controls',
  },
];

const steps = [
  {
    number: '01',
    title: 'Invite Eolian',
    description: 'Add the bot to your Discord server and join a voice channel.',
  },
  {
    number: '02',
    title: 'Add a track',
    description: 'Paste a link or search for a song, album, or playlist to add to the queue.',
  },
  {
    number: '03',
    title: 'Take turns picking',
    description: 'Use commands or player buttons to skip, pause, and choose what plays next.',
  },
];

const commandModes = [
  {
    label: 'Keyword',
    command: 'play my spotify top tracks shuffle',
    description: 'Write the options out as words.',
  },
  {
    label: 'Traditional',
    command: 'play -my -spotify -tracks -top -shuffle',
    description: 'Use short flags for each option.',
  },
  {
    label: 'Slash',
    command: '/play source:spotify resource:top-tracks',
    description: 'Choose options from Discord’s slash command menu.',
  },
];

export const HomePage = () => (
  <>
    <section className="relative isolate overflow-hidden">
      <div className="hero-orb hero-orb-one" />
      <div className="hero-orb hero-orb-two" />
      <div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-28">
        <div className="relative z-10 max-w-3xl">
          <Chip color="accent" variant="soft">
            <Sparkles aria-hidden="true" className="size-4" />
            Music for your Discord voice channel
          </Chip>
          <h1 className="font-display mt-7 text-balance text-5xl font-bold leading-[0.94] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Bring the songs. <span className="text-accent">Eolian handles the queue.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">
            Add a song by name or link, queue a playlist, and take turns choosing what plays next in
            your Discord voice channel.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              className={buttonVariants({ size: 'lg', variant: 'primary' })}
              href={discordInviteUrl}
            >
              Add Eolian to Discord
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
            <a
              className={buttonVariants({ size: 'lg', variant: 'secondary' })}
              href="#how-it-works"
            >
              See how it works
            </a>
          </div>
          <p className="mt-5 text-sm text-muted">
            Open source. Start with a command in Discord, not a dashboard.
          </p>
        </div>

        <div className="discord-scene relative mx-auto w-full max-w-xl" aria-hidden="true">
          <div className="discord-scene-glow" />
          <div className="discord-window">
            <div className="discord-window-bar">
              <span className="discord-channel">
                <span>#</span> listening-room
              </span>
              <span className="discord-presence">
                <span className="discord-presence-dot" />
                Music is on
              </span>
            </div>
            <div className="discord-message">
              <img alt="" className="discord-bot-avatar" height="40" src={logoUrl} width="40" />
              <div className="discord-message-body">
                <div className="discord-message-meta">
                  <strong>Eolian</strong>
                  <span>BOT</span>
                  <small>Today at 8:42 PM</small>
                </div>
                <div className="discord-embed">
                  <div className="discord-embed-header">
                    <span className="discord-source-icon">
                      <Music2 aria-hidden="true" className="size-4" />
                    </span>
                    <span>Now Playing</span>
                    <span className="discord-volume">
                      <Volume2 aria-hidden="true" className="size-4" />
                      78%
                    </span>
                  </div>
                  <p className="discord-track-title">After the Rain</p>
                  <p className="discord-track-artist">by Lowlight Atlas</p>
                  <div className="discord-artwork">
                    <span className="discord-artwork-line" />
                  </div>
                </div>
                <div className="discord-transport">
                  <span className="discord-transport-tile">
                    <ListMusic aria-hidden="true" className="size-5" />
                  </span>
                  <span className="discord-transport-tile">
                    <SkipBack aria-hidden="true" className="size-5" />
                  </span>
                  <span className="discord-transport-tile">
                    <Pause aria-hidden="true" className="size-5" />
                  </span>
                  <span className="discord-transport-tile">
                    <SkipForward aria-hidden="true" className="size-5" />
                  </span>
                  <span className="discord-transport-tile">
                    <Square aria-hidden="true" className="size-5" />
                  </span>
                </div>
              </div>
            </div>
            <div className="discord-composer">Message #listening-room</div>
          </div>
        </div>
      </div>
    </section>

    <section className="section-shell" id="features">
      <div className="section-heading">
        <p className="eyebrow">What you can play</p>
        <h2>One song or a whole playlist. Your call.</h2>
        <p>
          Add tracks from Spotify, SoundCloud, and YouTube. The queue and playback controls live in
          Discord.
        </p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {features.map(feature => {
          const Icon = feature.icon;

          return (
            <Card className="feature-card" key={feature.title}>
              <Card.Header>
                <div className="feature-icon">
                  <Icon aria-hidden="true" className="size-6" />
                </div>
                <Card.Title>{feature.title}</Card.Title>
                <Card.Description>{feature.description}</Card.Description>
              </Card.Header>
              <Card.Footer>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  {feature.detail}
                </span>
              </Card.Footer>
            </Card>
          );
        })}
      </div>
    </section>

    <section className="border-y border-separator bg-surface" id="how-it-works">
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="section-heading text-left">
            <p className="eyebrow">Getting started</p>
            <h2>Invite Eolian. Queue a song. Take turns.</h2>
            <p>
              You can listen without setting up the website. Sign in when you want to change account
              or server settings.
            </p>
          </div>
          <ol className="grid gap-4">
            {steps.map(step => (
              <li className="step-card" key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>

    <section className="section-shell" id="command-modes">
      <div className="section-heading">
        <p className="eyebrow">Pick your command style</p>
        <h2>Keywords, flags, or slash commands.</h2>
        <p>Pick keywords or flags for message commands. Slash commands work either way.</p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {commandModes.map(mode => (
          <article className="command-card" key={mode.label}>
            <div className="flex items-center justify-between">
              <h3>{mode.label}</h3>
              <span className="size-2 rounded-full bg-accent shadow-[0_0_0_5px_color-mix(in_oklch,var(--accent),transparent_82%)]" />
            </div>
            <code>{mode.command}</code>
            <p>{mode.description}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="px-5 pb-20 pt-6 sm:px-8 sm:pb-28">
      <div className="cta-panel mx-auto max-w-7xl">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Your next track
          </p>
          <h2 className="font-display mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">
            Ready to put something on?
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Add Eolian to your server to play music. Sign in with Discord to change your settings.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className={buttonVariants({ size: 'lg', variant: 'primary' })}
              href={discordInviteUrl}
            >
              Add to Discord
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              href={discordLoginUrl('/app')}
            >
              Sign in to workspace
            </a>
          </div>
        </div>
      </div>
    </section>
  </>
);

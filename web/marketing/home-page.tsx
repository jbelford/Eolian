import { Card, Chip } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { Link } from 'react-router-dom';
import { discordInviteUrl } from '../config/discord-invite';
import {
  ArrowUpRightIcon,
  CommandIcon,
  HeadphonesIcon,
  QueueIcon,
  SparklesIcon,
} from '../components/icons';

const features = [
  {
    icon: QueueIcon,
    title: 'A queue that keeps the room moving',
    description:
      'Bring in songs, albums, playlists, artist catalogs, likes, and top tracks without rebuilding the queue by hand.',
    detail: 'Spotify, SoundCloud, and YouTube-aware resolution',
  },
  {
    icon: CommandIcon,
    title: 'Commands that meet people where they are',
    description:
      'Use natural keywords, familiar flags, or Discord slash commands. Every mode reaches the same dependable command system.',
    detail: 'Keyword, traditional, and slash syntax',
  },
  {
    icon: HeadphonesIcon,
    title: 'Playback shaped for a shared channel',
    description:
      'Skip, shuffle, loop, adjust volume, and add audio effects while Eolian keeps controls and queue state close at hand.',
    detail: 'Interactive player and queue controls',
  },
];

const steps = [
  {
    number: '01',
    title: 'Invite Eolian',
    description:
      'Add the bot to a Discord server, then choose the text and voice channels where your group gathers.',
  },
  {
    number: '02',
    title: 'Ask for the music',
    description:
      'Paste a link or describe what you want. Eolian resolves the source and builds a playable queue.',
  },
  {
    number: '03',
    title: 'Run the room together',
    description:
      'Use shared controls to tune playback, reorder the moment, or let the queue carry everyone forward.',
  },
];

const commandModes = [
  {
    label: 'Keyword',
    command: 'play my spotify top tracks shuffle',
    description: 'Readable requests that feel natural in conversation.',
  },
  {
    label: 'Traditional',
    command: 'play -my -spotify -tracks -top -shuffle',
    description: 'Explicit flags for people who prefer a terminal-like rhythm.',
  },
  {
    label: 'Slash',
    command: '/play source:spotify resource:top-tracks',
    description: 'Discord-native discovery with guided options.',
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
            <SparklesIcon className="size-4" />
            Discord music, without the friction
          </Chip>
          <h1 className="font-display mt-7 text-balance text-5xl font-bold leading-[0.94] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Turn a voice channel into <span className="text-accent">the place everyone stays.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">
            Eolian turns links, searches, playlists, and passing ideas into a shared queue your
            Discord server can shape together.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              className={buttonVariants({ size: 'lg', variant: 'primary' })}
              href={discordInviteUrl}
            >
              Add Eolian to Discord
              <ArrowUpRightIcon className="size-5" />
            </a>
            <a
              className={buttonVariants({ size: 'lg', variant: 'secondary' })}
              href="#how-it-works"
            >
              See how it works
            </a>
          </div>
          <p className="mt-5 text-sm text-muted">
            Open source. No dashboard setup required to start listening.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-hidden="true">
          <div className="player-glow" />
          <div className="player-card">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                  Now playing
                </p>
                <p className="mt-1 font-semibold text-white">Midnight drive mix</p>
              </div>
              <div className="flex gap-1.5">
                <span className="size-2 rounded-full bg-cyan-300" />
                <span className="size-2 rounded-full bg-violet-300" />
                <span className="size-2 rounded-full bg-fuchsia-300" />
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="album-art">
                <div className="album-ring album-ring-one" />
                <div className="album-ring album-ring-two" />
                <div className="album-core">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="mt-7 flex items-end justify-between gap-6">
                <div>
                  <p className="text-lg font-semibold text-white">A queue for the whole room</p>
                  <p className="mt-1 text-sm text-white/55">12 tracks · shaped by 5 listeners</p>
                </div>
                <div className="equalizer">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400" />
              </div>
            </div>
          </div>
          <div className="floating-note floating-note-one">Spotify playlist added</div>
          <div className="floating-note floating-note-two">Shuffle on</div>
        </div>
      </div>
    </section>

    <section className="section-shell" id="features">
      <div className="section-heading">
        <p className="eyebrow">Built for real listening sessions</p>
        <h2>Less time managing the bot. More time sharing the room.</h2>
        <p>
          Eolian keeps a powerful music system approachable, whether someone brings a single song or
          an entire listening history.
        </p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {features.map(feature => {
          const Icon = feature.icon;

          return (
            <Card className="feature-card" key={feature.title}>
              <Card.Header>
                <div className="feature-icon">
                  <Icon className="size-6" />
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
            <p className="eyebrow">From invite to encore</p>
            <h2>Three steps between “what should we play?” and play.</h2>
            <p>
              The public experience stays simple. Deeper account and server controls will live in
              the signed-in workspace.
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
        <p className="eyebrow">One command system, three ways in</p>
        <h2>Speak naturally, use flags, or stay inside Discord’s UI.</h2>
        <p>
          Every syntax is normalized before a command runs, so people can use the style that makes
          sense to them without splitting the server into separate workflows.
        </p>
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
            Bring the next song
          </p>
          <h2 className="font-display mt-4 text-4xl font-bold tracking-[-0.05em] text-white sm:text-5xl">
            Give your server a better reason to stay in voice.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Invite Eolian now, or enter the workspace placeholder to see where account and guild
            tools will arrive next.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className={buttonVariants({ size: 'lg', variant: 'primary' })}
              href={discordInviteUrl}
            >
              Add to Discord
              <ArrowUpRightIcon className="size-5" />
            </a>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              to="/app"
            >
              Preview workspace
            </Link>
          </div>
        </div>
      </div>
    </section>
  </>
);

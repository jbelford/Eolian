# Discord end-to-end playback harness

The harness uses a separate Discord bot application to test a running Eolian instance. It never
uses a user token or self-bot.

Eolian normally ignores every bot-authored message to prevent bot loops. When the E2E feature is
explicitly enabled, one configured bot account may mention Eolian in one configured text channel.
That exception accepts only the normal `play` command, so the test exercises the same Discord
message, invocation, parsing, permission, resolver, queue, player, and voice path as a human
message.

The only HTTP endpoint is authenticated, read-only state inspection. Playback and cleanup are
both initiated through Discord chat.

## What the test proves

Automated chat mode requires all of these signals before passing:

1. A message event from the configured Eolian application in the configured text channel.
2. Eolian present in the configured voice channel.
3. Opus packets from Eolian or decoded PCM above the configured byte and RMS thresholds.
4. Eolian's read-only state reporting an active stream, current track, and matching voice channel.

Voice packets are the strongest external playback signal. Local state distinguishes media or
player failures from Discord delivery failures. The text response proves that the real command
path handled the request.

## Discord applications and permissions

Create a separate Discord application and bot for the harness. Invite Eolian and the test
application to a dedicated test guild.

The test bot needs:

- `View Channel` and `Connect` in the configured voice channel.
- `View Channel` and `Send Messages` in the configured text channel.
- Eolian's configured DJ role if that guild restricts music commands to specific roles.

The test bot joins self-muted but not self-deafened so it can receive Eolian's audio. It does not
need the Message Content privileged intent because it only sends its command and observes the
author and channel of Eolian message events.

Eolian retains its normal text and voice permissions, including `View Channel`, `Send Messages`,
`Embed Links`, `Read Message History`, `Connect`, and `Speak`. Eolian already uses Message Content
for legacy message commands.

## Enable Eolian's test mode

Set these variables on the Eolian process:

```dotenv
E2E_TEST_ENABLED=true
E2E_TEST_STATE_TOKEN=<long-random-secret>
E2E_TEST_GUILD_ID=<test-guild-id>
E2E_TEST_TEXT_CHANNEL_ID=<test-text-channel-id>
E2E_TEST_VOICE_CHANNEL_ID=<test-voice-channel-id>
E2E_TEST_ACTOR_ID=<separate-test-bot-user-id>
```

The exception is exact: the author must be a bot with `E2E_TEST_ACTOR_ID`, the guild and channel
must match, and the message must mention Eolian. All other bot-authored messages remain ignored.
The allowlisted bot may run only `play`.

`GET /test-state` is protected by the state token and accepts loopback requests by default. Set
`E2E_TEST_ALLOW_REMOTE_STATE=true` only when the harness cannot reach Eolian over loopback or a
private tunnel.

Eolian refuses to start an E2E run unless its player is idle and its queue is empty. While a run is
active, normal commands in the test guild are rejected. Cleanup requires the active run ID and
refuses to proceed if the current track or queue changed unexpectedly.

## Run locally

Copy `test/e2e/.env.example` to `test/e2e/.env`, fill in the separate test application and channel
IDs, then run:

```bash
set -a
source test/e2e/.env
set +a
yarn e2e
```

The default request type is a YouTube URL. The harness sends a real Discord message equivalent to:

```text
@Eolian play https://www.youtube.com/watch?v=HEXWRTEbj1I
```

Search requests use Eolian's normal keyword syntax:

```dotenv
E2E_SOURCE=youtube
E2E_REQUEST_TYPE=search
E2E_REQUEST=known short test track
```

which sends:

```text
@Eolian play (known short test track) youtube fast
```

`spotify` and `soundcloud` are accepted source values so their normal resolvers can use the same
transport and verification pipeline. Prefer source URLs for deterministic tests. Spotify song
search follows Eolian's existing behavior and may resolve through YouTube.

After verification, the harness sends:

```text
@Eolian e2e-cleanup <run-id>
```

This is not a general Eolian command. It is recognized only from the configured test bot in the
configured guild and channel, and only for the active run.

## Run against production

Production Eolian test mode is blocked unless the Eolian process explicitly sets:

```dotenv
NODE_ENV=production
E2E_TEST_ALLOW_PRODUCTION=true
```

The harness also requires both confirmations:

```dotenv
E2E_TARGET=production
E2E_ALLOW_PRODUCTION=true
E2E_PRODUCTION_CONFIRM=EOLIAN_PRODUCTION_E2E
E2E_STATE_URL=https://<production-state-endpoint>
```

Use a dedicated production test guild and short, known media. The idle-player and empty-queue
precondition prevents the harness from taking over an existing session, and run-bound cleanup
prevents an unrelated caller from stopping playback.

## Human-triggered mode

If Eolian's bot-message exception cannot be enabled, set:

```dotenv
E2E_TRIGGER_MODE=human
```

Start `yarn e2e`, then have a real user send the printed command in the test channel. This remains
compliant because the human initiates the request. The harness verifies Eolian's response, voice
state, and received audio, but does not require the read-only local-state signal. The human
operator is responsible for stopping playback and clearing any remaining queue afterward.

## Limitations

- Discord voice negotiation, media startup, external source availability, and network delivery
  can fail independently; multiple signals make failures diagnosable, not perfectly deterministic.
- Audio energy is supporting evidence because quiet media can have low RMS. The packet threshold
  is the fallback.
- The test verifies delivery to Discord, not a listener's client-side volume or output device.
- Run the automated mode in a dedicated guild. Blocking normal commands during an active run
  prevents queue races but intentionally makes that guild unavailable until cleanup finishes.
- Keep E2E test mode disabled outside deliberate test windows.

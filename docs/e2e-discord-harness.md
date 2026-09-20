# Discord end-to-end playback harness

The harness uses a separate Discord bot application to test Eolian through Discord. It never uses
a user token or self-bot.

Eolian normally ignores bot-authored messages to prevent bot loops. Setting `E2E_BOT_ID` allows
one bot account through that existing guard. The allowlisted bot otherwise follows exactly the
same command path as a human: invocation detection, parsing, permissions, resolvers, queue, player,
and Discord voice.

There is no test control API, special cleanup protocol, configured test guild, or internal test
session in Eolian.

## What the test proves

Automated chat mode requires all of these independent Discord signals:

1. A message event from the configured Eolian application in the configured text channel.
2. Eolian present in the voice channel joined by the test bot.
3. Opus packets from Eolian or decoded PCM above the configured byte and RMS thresholds.

A command response alone is not sufficient because media resolution, streaming, encoding, and
Discord voice delivery can fail afterward. Voice packets are the strongest external playback
signal; decoded energy provides supporting evidence.

## Eolian configuration

Set only the separate test bot's Discord user ID:

```dotenv
E2E_BOT_ID=<separate-test-bot-user-id>
```

When this variable is absent, Eolian continues ignoring every bot-authored message. When present,
only that bot bypasses the bot-author guard. It is not restricted to a particular guild, text
channel, voice channel, or command, so protect the test bot token and grant it only the Discord
permissions and Eolian roles it needs.

## Discord applications and permissions

Create a separate Discord application and bot for the harness. Invite Eolian and the test
application to a dedicated test guild.

The test bot needs:

- `View Channel` and `Connect` in the selected voice channel.
- `View Channel` and `Send Messages` in the selected text channel.
- Eolian's configured DJ role if that guild restricts music commands by role.

The test bot joins self-muted but not self-deafened so it can receive Eolian's audio. It does not
need the Message Content privileged intent because it sends commands and only observes the author
and channel of Eolian message events.

Eolian retains its normal text and voice permissions, including `View Channel`, `Send Messages`,
`Embed Links`, `Read Message History`, `Connect`, and `Speak`. Eolian already uses Message Content
for legacy message commands.

## Run locally

Copy `test/e2e/.env.example` to `test/e2e/.env`, fill in the separate test application, guild, and
channel IDs, then run:

```bash
set -a
source test/e2e/.env
set +a
yarn e2e
```

The default request type is a YouTube URL. The harness sends a normal message equivalent to:

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
Discord and verification path. Prefer source URLs for deterministic tests. Spotify song search
follows Eolian's existing behavior and may resolve through YouTube.

The harness cleans up through ordinary Eolian commands:

```text
@Eolian stop
@Eolian list clear
```

It waits for Eolian to leave voice and exits nonzero if cleanup fails.

## Run against production

The harness refuses production unless both confirmations are present:

```dotenv
E2E_TARGET=production
E2E_ALLOW_PRODUCTION=true
E2E_PRODUCTION_CONFIRM=EOLIAN_PRODUCTION_E2E
```

Before sending the play command, the harness refuses to continue if Eolian is already connected to
any voice channel in the selected guild. Use a dedicated production test guild because Discord
does not expose Eolian's internal queue to another bot; an inactive voice connection cannot prove
that the queue is empty.

`E2E_BOT_ID` is itself the server-side opt-in. Remove it from the production Eolian environment
outside deliberate test windows.

## Human-triggered mode

Set:

```dotenv
E2E_TRIGGER_MODE=human
```

The harness prints the exact command for a real user to send. It then verifies Eolian's response,
voice state, and audio. The human operator is responsible for stopping playback and clearing the
queue afterward.

## Limitations

- Discord voice negotiation, media startup, external source availability, and network delivery
  can fail independently; multiple signals make failures diagnosable, not perfectly deterministic.
- Quiet media may not cross the RMS threshold, so packet count is the fallback audio signal.
- The test verifies delivery to Discord, not a listener's client-side volume or output device.
- The harness cannot inspect Eolian's queue without adding production-only introspection, so use a
  dedicated guild for non-destructive production testing.
- The allowlisted bot can invoke any command its Discord/Eolian permissions permit. Keep its token
  private, minimize its roles, and unset `E2E_BOT_ID` when testing is not intended.

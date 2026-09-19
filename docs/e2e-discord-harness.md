# Discord end-to-end playback harness

The harness uses a separate Discord bot application to verify a running Eolian instance. It
never uses a user token or self-bot. Eolian intentionally ignores bot-authored messages, so the
test bot cannot safely drive Eolian by posting a legacy command. Automated mode instead uses an
authenticated Eolian control endpoint that is disabled by default and scoped to one guild, text
channel, voice channel, and test-bot account.

## What the test proves

The default automated test does not treat a successful command response as proof of playback. It
requires all of these signals before passing:

1. A message event from the configured Eolian application in the configured text channel.
2. Eolian present in the configured voice channel.
3. Opus packets from Eolian or decoded PCM above the configured byte and RMS thresholds.
4. Eolian's local state reporting an active stream, current track, and matching voice channel.

Voice packet reception is the strongest external signal, while local state identifies failures
before Discord receives audio. The text response confirms that the request reached the expected
application. Human-triggered mode omits local-state verification and is therefore less conclusive.

## Discord applications and permissions

Create a separate Discord application and bot for the harness. Invite both applications to a
dedicated test guild. The harness bot needs:

- `View Channel` and `Connect` in the voice channel.
- `View Channel` in the text channel.

It joins self-muted but not self-deafened so it can receive Eolian's audio. Eolian retains its
normal `View Channel`, `Send Messages`, `Embed Links`, `Read Message History`, `Connect`, and
`Speak` permissions. No Message Content privileged intent is required by the harness because it
only observes the author and channel of Eolian message events.

## Enable the Eolian control endpoint

Set these variables on the Eolian process:

```dotenv
E2E_CONTROL_ENABLED=true
E2E_CONTROL_TOKEN=<long-random-secret>
E2E_CONTROL_GUILD_ID=<test-guild-id>
E2E_CONTROL_TEXT_CHANNEL_ID=<test-text-channel-id>
E2E_CONTROL_VOICE_CHANNEL_ID=<test-voice-channel-id>
E2E_CONTROL_ACTOR_ID=<separate-test-bot-user-id>
```

By default, `/test-control/*` accepts only loopback requests. Set
`E2E_CONTROL_ALLOW_REMOTE=true` only when the harness cannot reach Eolian over loopback or a
private tunnel. The endpoint uses bearer authentication, rejects request bodies over 4 KiB, and
does not accept arbitrary guild or channel IDs.

Production additionally requires:

```dotenv
NODE_ENV=production
E2E_CONTROL_ALLOW_PRODUCTION=true
E2E_CONTROL_ALLOW_REMOTE=true # only if the caller is not local
```

Production control refuses to start if Eolian is already streaming or has queued tracks. Cleanup
requires the run ID returned by the play request and refuses production cleanup if the current
track or queue changed concurrently, so a caller cannot silently stop an unrelated session. Use a
dedicated production test guild and short, known media.

## Run locally

Start Eolian with the control variables above, then configure the harness from
`test/e2e/.env.example`:

```bash
set -a
source test/e2e/.env
set +a
yarn e2e
```

The default request type is a YouTube URL. Search requests are also supported:

```dotenv
E2E_SOURCE=youtube
E2E_REQUEST_TYPE=search
E2E_REQUEST=known short test track
```

`spotify` and `soundcloud` are accepted source values so the same transport and verification
pipeline can cover those resolvers. Prefer source URLs for deterministic tests; Spotify song
search follows Eolian's normal behavior and may resolve through YouTube.

## Run against production

Production is blocked unless both harness confirmations are present:

```dotenv
E2E_TARGET=production
E2E_ALLOW_PRODUCTION=true
E2E_PRODUCTION_CONFIRM=EOLIAN_PRODUCTION_E2E
E2E_CONTROL_URL=https://<production-control-endpoint>
```

Then run `yarn e2e`. The harness always attempts run-ID cleanup and exits nonzero if verification
or cleanup fails.

## Human-triggered mode

If the control endpoint cannot be enabled, set:

```dotenv
E2E_TRIGGER_MODE=human
```

Start `yarn e2e`, then have a real Discord user issue the configured play request in the test
channel. This remains compliant because the human initiates the command. The harness verifies the
Discord response, Eolian voice state, and received audio, but cannot verify Eolian's local queue or
player state.

## Limitations

- Discord voice delivery, encryption negotiation, media startup, and external source availability
  can fail independently; the timeout and multiple signals make failures diagnosable, not
  perfectly deterministic.
- Audio energy is a supporting signal because quiet media can have low RMS. The packet threshold
  provides the fallback.
- The test validates meaningful delivery to Discord, not what a human hears after client-side
  volume, output-device, or network processing.
- Keep the control endpoint disabled outside deliberate test windows.

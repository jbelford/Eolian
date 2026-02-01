# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build for production
yarn build

# Build for development (with source maps)
yarn build-dev

# Build web frontend
yarn build-web

# Run the bot (requires .env file)
yarn start

# Debug with inspector
yarn start-debug

# Lint TypeScript
yarn lint

# Format code with Prettier
yarn format
```

## Architecture Overview

Eolian is a Discord music bot built with TypeScript, bundled with Webpack into `dist/bundle.js`.

### Entry Point and Initialization

`src/app.ts` bootstraps four core components in order:
1. **AuthProviders** (`createAuthProviders`) - OAuth token management for Spotify/SoundCloud
2. **Database** (`createDatabase`) - MongoDB connection with users/servers collections
3. **CommandParsingStrategy** (`createCommandParsingStrategy`) - Parses user input into commands
4. **DiscordEolianBot** - Main bot instance handling Discord events
5. **WebServer** - Express server for OAuth callbacks (runs on PORT, default 8080)

All components registered with `cleanupOnExit` for graceful shutdown.

### Module Organization

Modules use path aliases (`@eolian/*`) automatically generated from `src/` subdirectories (defined in webpack.prod.js). Each module exports through `index.ts` and defines types in `@types.ts`.

Key modules:
- `src/framework/` - Discord.js abstraction layer, bot core, state management, voice connections
- `src/commands/` - Command definitions organized by category (music, queue, account, settings, general, owner)
- `src/resolvers/` - Factory pattern for creating resolvers/fetchers based on command options
- `src/api/` - External API clients (YouTube, Spotify, SoundCloud, Poetry, OpenAI)
- `src/data/` - MongoDB collections and in-memory caches
- `src/command-options/` - Keyword/pattern parsing for the three syntax modes
- `src/embed/` - Discord embed builders for queue, help, auth flows
- `src/http/` - OAuth flow handlers and authorization code providers

### Command System

Commands implement `Command` interface with:
- `execute(context, options)` - Main handler receiving parsed options
- `patterns` - Define what arguments the command accepts
- `keywords` - Boolean flags the command supports
- `permission` - Required `UserPermission` level (BLOCKED < USER < DJ < ADMIN < OWNER)

Three syntax modes (`SyntaxType`):
- **KEYWORD** - Natural language: `add my spotify playlist shuffle`
- **TRADITIONAL** - Flag-based: `add -my -spotify -playlist -shuffle`
- **SLASH** - Discord slash commands

### State Management (Guild Store)

Each guild (Discord server) gets lazy-initialized state via `DiscordGuildStore`:
- **DiscordGuildState** - Created on first command in a guild, cached with TTL (default 15 min)
- **ServerMusicQueue** - Guild-specific queue backed by `InMemoryQueueCache` (3-hour TTL)
- **DiscordPlayer** - Audio player instance with volume, effects (nightcore, bassboost)
- **ServerStateDisplay** - Queue and player displays (messages with buttons)

State expires when idle (no queue, no playback). Partial cleanup keeps data if only one component idle.

### Track Resolution and Fetching

Resolution happens in two phases via factory pattern (`src/resolvers/index.ts`):

**Phase 1: Resolve to Identifier**
- `getSourceResolver(context, options)` returns appropriate `SourceResolver` based on:
  - URL source (Spotify/YouTube/SoundCloud detected from URL)
  - Keyword combination (ALBUM → Spotify, PLAYLIST + MY → check if Spotify/SoundCloud based on flags)
  - Resource type keywords (ALBUM, PLAYLIST, ARTIST, LIKES, TRACKS, SONG)
  - Source keywords (SPOTIFY, SOUNDCLOUD, YOUTUBE)
- Resolver queries API and may present selection UI (e.g., multiple playlists found)
- Returns `ResolvedResource` with `Identifier` and `SourceFetcher`

**Phase 2: Fetch Tracks**
- `SourceFetcher.fetch()` retrieves actual track list
- For Spotify: resolves to YouTube tracks (Spotify songs → YouTube search)
- Handles range optimization (TOP/BOTTOM patterns applied during fetch if supported)
- Returns `Track[]` with metadata (title, poster, url, stream, artwork, duration)

**Keyword-based routing logic:**
- Default song search → YouTube (unless SOUNDCLOUD flag or YouTube restricted)
- ALBUM always → Spotify
- PLAYLIST without MY → YouTube (unless SPOTIFY/SOUNDCLOUD specified)
- ARTIST → Spotify (or SoundCloud if flagged)
- LIKES/TRACKS require OAuth (Spotify if enabled, else SoundCloud)

### Audio Streaming Pipeline

Once tracks in queue, `DiscordPlayer` manages playback:

```
Queue → Track.stream URL → FFmpeg (PCM) → Volume Transform → Opus Encoder → Discord Voice
```

Stream pipeline (`src/framework/voice/discord-player.ts`):
1. `player.play()` pops track from queue
2. Fetches stream via `StreamFetcher.getStream()` (YouTube/SoundCloud clients)
3. `SongStream` wraps stream with FFmpeg filters (nightcore, bassboost, volume)
4. `AudioResource` created from transformed stream
5. `AudioPlayer` plays resource through `DiscordVoiceConnection`
6. On idle (song ends), automatically plays next track

Voice connection handling:
- `DiscordVoiceChannel` - Join/leave, check if people listening
- `DiscordVoiceConnection` - Wraps @discordjs/voice connection, handles reconnects
- Player auto-stops after 3min timeout if no activity
- Connection closes if no one listening

### Data Layer

MongoDB collections:
- **users** - Linked accounts (Spotify/SoundCloud IDs), OAuth refresh tokens, custom identifiers, syntax preference
- **servers** - Prefix, volume, syntax, DJ roles, last usage tracking

Caching:
- `EolianCache<V>` - Generic TTL cache interface
- `QueueCache<T>` - Queue-specific operations (pop, push, shuffle) with loop track support
- In-memory LRU cache for OAuth access tokens (75-minute TTL)

### Event Flow (Discord Bot)

`DiscordEolianBot` (`src/framework/discord-bot.ts`) handles three Discord event types:

1. **MESSAGE_CREATE** - Legacy message commands
   - Check if bot invoked (mention or prefix match)
   - Lock user to prevent concurrent commands (`LockManager`, 60s timeout)
   - Parse via `CommandParsingStrategy` into `ParsedCommand`
   - Execute command with context

2. **INTERACTION_CREATE (slash/context menu)** - Modern Discord interactions
   - Chat input commands (slash commands)
   - Message context menu commands (right-click message)
   - Button interactions (handled by `ButtonRegistry`)

3. **GUILD_CREATE** - New guild joined (optional old token migration)

All commands go through:
- Permission check (user's `UserPermission` level vs command requirement)
- Guild state initialization (lazy `DiscordGuildStore.getState()`)
- Command execution with `CommandContext` (interaction, server state, client)
- Default reply if command has no custom reply
- Usage tracking (updates server lastUsage timestamp)

### Button Interactions

`ButtonRegistry` tracks ephemeral message buttons by `messageId:customId`:
- Custom ID = emoji (e.g., "⏭️", "🔀", "⏹️")
- Buttons self-register when message sent with `EmbedMessage.buttons`
- Each button has:
  - `onClick` handler returning boolean (true = destroy message and release buttons)
  - Optional `permission` requirement (DJ, ADMIN, etc.)
  - Optional `userId` restriction (only that user can click)
- Player buttons (play, pause, skip, shuffle, stop) in `DiscordPlayerDisplay`
- Queue buttons (next page, shuffle) in `DiscordQueueDisplay`
- Message automatically releases buttons when destroyed

### Environment Configuration

All config loaded via `src/common/env.ts` from environment variables:

**Required:**
- `DISCORD_TOKEN` - Bot token
- `MONGO_URI`, `MONGO_DB_NAME` - Database connection
- `YOUTUBE_TOKEN` - YouTube Data API v3 key
- `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET` - SoundCloud API
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` - Spotify API
- `SPEECH_SERVICE_KEY`, `SPEECH_SERVICE_REGION` - Azure Speech (for poetry TTS)

**Optional:**
- `COMMAND_TOKEN` - Command prefix (default: `!`)
- `OWNERS` - Comma-separated Discord user IDs with OWNER permission
- `PORT` - Web server port (default: 8080)
- `BASE_URI` - OAuth callback base URL
- `DISCORD_TOKEN_OLD` - Old bot token for migration
- `YOUTUBE_ALLOWLIST` - Guild IDs allowed to use YouTube
- `OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, `OPENAI_AUDIO_MODEL` - OpenAI integration
- `AZURE_OPENAI_*` - Azure OpenAI alternative

**Feature Flags:**
- `FLAG_SPOTIFY_OAUTH=true` - Enable Spotify user OAuth (likes, top tracks)
- `FLAG_SOUNDCLOUD_OAUTH=true` - Enable SoundCloud user OAuth
- `FLAG_DISCORD_OLD_LEAVE=true` - Auto-leave servers with old token
- `FLAG_ENABLE_WEBSITE=true` - Enable website routes
- `FLAG_ENABLE_POTOKEN_GEN=true` - Enable YouTube PO token generation

**Build-time injection:**
- `__COMMIT_DATE__` - Injected by webpack from git log (shown in bot status)

### User Lock System

`LockManager` prevents concurrent command execution per user:
- 60-second timeout (prevents commands stacking if one hangs)
- Locked users get "One command at a time please!" message
- Lock released in `finally` block after command completes
- Applies to both message and interaction commands

## Code Conventions

- **Prettier**: 100-char width, single quotes, arrow parens: avoid (`arrowParens: "avoid"`)
- **TypeScript**: Strict mode enabled (strict, strictNullChecks, noImplicitReturns, noUnusedLocals)
- **Interfaces over classes** for type definitions (see `@types.ts` files)
- **Error handling**:
  - Throw `EolianUserError` for user-facing errors (message shown to user)
  - Other errors show generic "something went wrong" message
  - Optional `context` on `EolianUserError` to edit specific message
- **Logging**: Winston logger with timestamp and colorization
  - `logger.info()` for command execution lifecycle
  - `logger.warn()` for recoverable errors
  - `logger.debug()` for verbose output (enabled with `DEBUG_ENABLED=true`)
- **Closable pattern**: Components implement `Closable` interface for cleanup
  - `close()` methods clean up connections, timers, caches
  - Registered with `cleanupOnExit()` for graceful shutdown

## Important Patterns

### Context Abstraction Layer

`src/framework/` abstracts Discord.js behind interfaces:
- **ContextUser** - Discord user with permission level, voice channel, database operations
- **ContextTextChannel** - Text channel with send/embed capabilities
- **ContextCommandInteraction** - Unified interface for slash commands and messages
- **ContextServer** - Guild details and settings
- **ContextClient** - Bot client operations

This allows command code to work with any interaction type without knowing Discord.js specifics.

### Lazy Initialization

Components initialize only when needed:
- Guild state created on first command (not on GUILD_CREATE event)
- Displays (`PlayerDisplay`, `QueueDisplay`) created when first needed
- Audio player created when first track played
- OAuth tokens fetched from cache or refreshed on demand

### Command Option Parsing

Three syntax types share same command logic via `CommandOptions` abstraction:
- **KEYWORD**: `add my spotify playlist shuffle` → `{MY: true, SPOTIFY: true, PLAYLIST: true, SHUFFLE: true}`
- **TRADITIONAL**: `add -my -spotify -playlist -shuffle` → same options object
- **SLASH**: Slash command options → same options object

`CommandOptionsParsingStrategy` handles all three, commands only see final options.

Pattern priority determines parse order (higher priority parsed first). See `src/command-options/patterns/` for pattern implementations.

## Debugging

- **Start with debugger**: `yarn start-debug` enables Node inspector (breakpoint-ready)
- **Enable debug logging**: Set `DEBUG_ENABLED=true` in `.env`
- **Check guild state**: `DiscordGuildStore.active` shows count of active guilds
- **Voice connection issues**: Look for `AudioPlayerStatus` transitions in logs
- **Command not found**: Check `CommandStore.get()` with user's permission level
- **OAuth issues**: Verify tokens in MongoDB users collection and cache TTL (75 min)
- **Queue problems**: `QueueCache` backed by in-memory list (3-hour TTL), check `queue.size()`
- **Stream failures**: FFmpeg errors appear in `streamErrorHandler`, check source URL validity

Common issues:
- **YouTube 403**: PO token expired or quota exceeded
- **Spotify 401**: Refresh token invalid, user needs to re-link account
- **Voice connection stuck**: Check if anyone listening (`hasPeopleListening()`), connection auto-closes if empty

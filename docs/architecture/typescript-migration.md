# TypeScript Migration — Phase 4.1

## Status

**In Progress** — Infrastructure established, critical files typed.

## Migration Strategy

### Phase 4.1 (Current)
- [x] Activate pnpm monorepo
- [x] Create shared-types package with all domain models
- [x] Create API client package with typed methods
- [x] Set up TypeScript configurations
- [x] Create client-side type definitions
- [ ] Migrate all JS/JSX files to TypeScript (partial)
- [ ] Enable strict TypeScript (gradual)

### Phase 4.2 (Future)
- [ ] Complete JS → TS conversion for remaining files
- [ ] Enable strict TypeScript checking
- [ ] Add comprehensive unit tests
- [ ] Set up CI/CD pipeline
- [ ] Performance optimization

## File Inventory

### Current State
- **143 JS/JSX files** in client/src
- **21 JS files** in server/src
- **7 TS files** in packages/shared-types
- **11 TS files** in packages/api-client

### Target State
- All client files → TypeScript/TSX
- All server files → TypeScript
- All shared code → TypeScript with strict checking

## Migration Order

### Priority 1: Critical Infrastructure
1. `client/src/api.js` → API client usage
2. `client/src/lib/supabase.js` → Supabase client types
3. `client/src/lib/format.js` → Utility types
4. `client/src/storage.js` → Storage types

### Priority 2: Core Components
1. Player components (FullPlayer, MiniPlayer, QueuePanel)
2. Navigation components (BottomNav, SideNav, TopBar)
3. Sheet components (CommentsSheet, ShareSheet, etc.)

### Priority 3: Pages
1. HomePage
2. SearchPage
3. LibraryPage
4. ProfilePage
5. ArtistProfilePage
6. DiscoverPage

### Priority 4: Feature Components
1. AI components (AiDiscovery, ArtistAiTools, AssistantPage)
2. Social components (SocialFeedPage, CommentsPanel)
3. Room components (RoomPage, RoomsPage)

## Type Definitions

### Shared Types (`packages/shared-types/src/`)
- `track.ts` — Track, PlayEvent, TrackLike
- `artist.ts` — ArtistProfile, ArtistFollow, ArtistRelease
- `playlist.ts` — Playlist, PlaylistTrack, DailyMix
- `user.ts` — UserProfile, UserSummary, Session
- `social.ts` — ActivityEvent, SocialPost, Comment, Notification
- `room.ts` — Room, RoomParticipant, RoomPlayback
- `player.ts` — QueueItem, PlaybackState, LyricsLine
- `search.ts` — SearchResult, SearchTab
- `recommendation.ts` — RecommendationResponse, TasteProfile
- `intelligence.ts` — TrackAnalysis, MusicIntent, PlaylistPlan
- `assistant.ts` — AssistantMessage, AssistantResponse
- `api.ts` — ApiResponse, PaginatedResponse, APIError

### Client Types (`client/src/types/index.ts`)
- Legacy compatibility types
- Component prop types
- API response types
- Formatting helpers

## API Client

### Structure (`packages/api-client/src/`)
- `client.ts` — Core HTTP client with typed requests
- `config.ts` — Configuration management
- `errors.ts` — Error types
- `tracks.ts` — Track API methods
- `discovery.ts` — Discovery API methods
- `social.ts` — Social API methods
- `recommendations.ts` — Recommendations API methods
- `assistant.ts` — Assistant API methods

### Usage
```typescript
import { tracksApi, recommendationsApi } from "@4ang/api-client";

// Typed API calls
const tracks = await tracksApi.list({ limit: 20 });
const recs = await recommendationsApi.forYou(12, "home");
```

## TypeScript Configuration

### Client (`client/tsconfig.json`)
- `strict: false` (gradual migration)
- `allowJs: true` (allows existing JS files)
- `checkJs: false` (no type checking for JS)
- Path aliases for shared packages

### Server (`server/tsconfig.json`)
- `strict: false` (gradual migration)
- `allowJs: true`
- Path aliases for shared packages

### Shared Types (`packages/shared-types/tsconfig.json`)
- `strict: true` (fully typed)
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUncheckedIndexedAccess: true`

## Known Issues

1. **143 JS/JSX files** still need conversion
2. **Strict TypeScript** not yet enabled for client/server
3. **API client** not yet consumed by existing components
4. **Legacy types** used for compatibility (should be phased out)

## Next Steps

1. Migrate `api.js` to use `@4ang/api-client`
2. Convert critical utility files to TypeScript
3. Gradually enable strict checking
4. Update components to use typed API client
5. Remove legacy compatibility types

## Testing

### Validation Commands
```bash
# Check TypeScript compilation
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
cd packages/shared-types && npx tsc --noEmit
cd packages/api-client && npx tsc --noEmit

# Build verification
cd client && pnpm build
```

### Current Status
- ✅ Client builds successfully
- ✅ Server syntax valid
- ✅ Shared types compile
- ✅ API client compiles
- ⚠️ TypeScript strict mode not yet enabled
- ⚠️ Many files still JavaScript

# 4ang AI Security

## AI Security Model

### Principles

1. AI input is untrusted
2. AI tools require explicit authorization
3. AI cannot execute arbitrary SQL
4. AI cannot access service-role credentials
5. AI failure must not break core features

## Attack Surfaces

### Prompt Injection

**Risk**: User crafts input to override AI intent detection

**Mitigation**:
- Intent parsing uses keyword fallback when AI unavailable
- Tool arguments validated server-side
- AI tools constrained to specific operations
- No arbitrary code execution through AI

### Tool Abuse

**Risk**: AI executes unauthorized actions

**Mitigation**:
- Every tool requires authenticated user
- Tool calls validated against allowed tool registry
- Tool arguments validated per schema
- No `execute_sql` or `run_code` tools
- No access to environment variables or secrets

### Data Leakage

**Risk**: AI reveals private user data

**Mitigation**:
- AI receives minimal context (track IDs, not full user data)
- AI conversations stored per-user
- AI cannot access other users' data
- AI responses filtered before display

## Tool Authorization

| Tool | Auth Required | Role Required | Validation |
|------|---------------|---------------|------------|
| `searchTracks` | Yes | Any user | Query sanitized |
| `searchArtists` | Yes | Any user | Query sanitized |
| `getRecommendations` | Yes | Any user | User context only |
| `getLikedSongs` | Yes | Any user | Own data only |
| `createPlaylistDraft` | Yes | Any user | Name length limit |
| `playTrack` | Yes | Any user | Track ID validated |
| `notInterested` | Yes | Any user | Track ID validated |

### Forbidden Operations

❌ Direct SQL execution
❌ File system access
❌ Network requests to arbitrary URLs
❌ Access to environment variables
❌ Access to service-role keys
❌ Modification of auth data
❌ Cross-user data access

## AI Data Minimization

Only send to AI:
- Current track ID
- User taste profile (music preferences only)
- Conversation history (own conversations)
- Available tool schemas

Never send:
- Authentication tokens
- Service-role keys
- Private messages
- Full user profile
- Payment data

## Failure Handling

| Failure | Behavior |
|---------|----------|
| AI timeout | Return controlled timeout message |
| AI unavailable | Fall back to keyword-based intent |
| Tool execution fails | Return tool error safely |
| AI returns invalid JSON | Parse fallback response |

## Known Limitations

1. AI assistant stores conversations in database (RLS protects per-user)
2. No rate limiting on AI conversation length
3. AI tool registry is code-based (not declarative)
4. No content filtering on AI responses

## Recommendations

1. **P1**: Add conversation length limit
2. **P2**: Add content filtering on AI responses
3. **P2**: Add AI usage audit logging
4. **P3**: Declarative tool permission system

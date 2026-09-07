# 4ang Dependency Security

## Current Dependencies

### Node.js (Server)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | 4.x | HTTP framework |
| `cors` | 2.x | CORS middleware |
| `jsonwebtoken` | 9.x | JWT verification |
| `@supabase/supabase-js` | 2.x | Supabase client |
| `multer` | 2.x | File uploads |

### Node.js (Client)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.x | UI framework |
| `react-dom` | 19.x | React DOM |
| `react-router-dom` | 7.x | Routing |
| `@supabase/supabase-js` | 2.x | Supabase client |
| `framer-motion` | 13.x | Animations |
| `lucide-react` | 1.x | Icons |
| `recharts` | 3.x | Charts |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | 8.x | Build tool |
| `oxlint` | 1.x | Linter |
| `concurrently` | 9.x | Parallel scripts |
| `typescript` | 5.x | Type checking |

### Python

| Package | Purpose |
|---------|---------|
| `fastapi` | API framework |
| `uvicorn` | ASGI server |
| `pydantic` | Validation |

### C++

No external dependencies — self-contained audio engine.

## Security Measures

### CI Pipeline
- `pnpm audit --audit-level=high` runs in CI
- Secret detection in git diffs

### Lockfile
- `pnpm-lock.yaml` committed
- CI uses `--frozen-lockfile`

### Pinning
- Major versions pinned in package.json
- Lockfile pins exact versions

## Known Risks

1. `express` 4.x has known vulnerabilities in older versions — using latest 4.x
2. `multer` 2.x is new — monitor for issues
3. `framer-motion` 13.x — large dependency, monitor

## Recommendations

1. **P2**: Run `pnpm audit` regularly
2. **P2**: Review Dependabot alerts if configured
3. **P3**: Consider replacing `multer` with Supabase Storage-only uploads
4. **P3**: Minimize client bundle (currently ~600KB)

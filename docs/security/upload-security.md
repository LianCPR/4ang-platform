# 4ang Upload Security

## Upload Architecture

```
Browser
   ↓ multipart/form-data
API (Multer middleware)
   ↓ validation
Supabase Storage / Local Disk
```

## Current Upload Surface

| Asset Type | Endpoint | Auth Required |
|------------|----------|---------------|
| Track audio | `/api/submissions` | Yes (artist) |
| Avatar | Profile update | Yes (user) |
| Cover art | Playlist/album | Yes (artist) |
| Artist assets | Studio | Yes (artist) |

## Security Controls

### File Size Limits

| Asset | Max Size | Enforcement |
|-------|----------|-------------|
| JSON body | 1MB | Express `limit` |
| Event batch | 50 events | Application validation |
| Music files | Via Supabase | Storage bucket policy |

### MIME Validation

- Server should validate file type, not trust client MIME
- Multer configured for expected file types
- Supabase Storage has bucket-level type restrictions

### Path Traversal Prevention

- File names sanitized by storage service
- No user-provided paths used in filesystem operations
- Local disk uploads use deterministic naming

## Known Limitations

1. No explicit MIME validation middleware on upload routes
2. File type enforcement relies partially on Supabase Storage policies
3. No image content verification (magic bytes check)

## Recommendations

1. **P1**: Add server-side MIME type validation for uploads
2. **P2**: Add file magic byte verification for audio uploads
3. **P2**: Add explicit file extension allowlists
4. **P3**: Add image dimension validation for avatars/covers

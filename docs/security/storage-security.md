# 4ang Storage Security

## Architecture

```
Browser → API → Supabase Storage
                  ↓
              Bucket Policies
                  ↓
              File Access
```

## Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `audio` | Music files | Owner + public read (approved) |
| `covers` | Album/track artwork | Public read |
| `avatars` | User avatars | Public read |
| `artist-assets` | Artist images | Public read |

## Security Controls

### Bucket Policies
- Owner-based write access
- Public read for published assets
- No anonymous write access

### File Validation
- Size limits enforced at bucket level
- MIME type restrictions per bucket
- File naming controlled by server

### Signed URLs
- Used for private asset access
- Time-limited URLs
- No permanent public URLs for private data

## Known Limitations

1. No explicit image content verification (magic bytes)
2. File type enforcement relies on client + bucket policy
3. No automated virus scanning on uploads

## Recommendations

1. **P2**: Add server-side MIME validation for uploads
2. **P2**: Verify bucket policies match current schema
3. **P3**: Consider image content verification
4. **P3**: Add file size logging for monitoring

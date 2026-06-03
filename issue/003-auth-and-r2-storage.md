# Auth + R2 Storage Setup

## Goal
Allow users to authenticate and upload their own EPUB/PDF files to Cloudflare R2, replacing the current hardcoded `public/data/` books.

## Steps

### 1. Supabase Auth
- [ ] Add `@supabase/supabase-js` and `@supabase/ssr` to `apps-foliate`
- [ ] Create Supabase client helpers for Next.js App Router (`src/lib/supabase/`)
- [ ] Add auth UI: Login / Signup page or modals
- [ ] Wrap layout with `SessionProvider` (or custom React context)
- [ ] Protect `/reader/[slug]` — only authenticated users can read

### 2. User Library (R2 Upload)
- [ ] Set up Cloudflare R2 bucket (public-read for files, private for uploads)
- [ ] Create API route `POST /api/upload` → generates presigned URL, uploads to R2
- [ ] Create API route `GET /api/books` → returns user's uploaded books from DB
- [ ] Create Supabase table `user_books`:
  - `id`, `user_id`, `title`, `author`, `filename`, `r2_key`, `genre`, `status`, `created_at`
- [ ] Replace `/data/books.json` with DB-backed library on home page
- [ ] Replace `/data/{filename}` fetch with R2 signed URLs for reading

### 3. Migration
- [ ] Seed existing `books.json` entries into `user_books` for the first user
- [ ] Keep `public/data/` fallback for unauthenticated users (optional)

### 4. UI
- [ ] Add "Upload Book" button on Home Page (already has [+] Add button)
- [ ] Show user's uploaded books from DB on Home Page
- [ ] Add avatar / user menu in sidebar header

## Data Model

```sql
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  genre TEXT,
  status TEXT DEFAULT 'want',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## File Structure

```
src/
  app/
    auth/
      login/page.tsx
      callback/route.ts
    api/
      upload/route.ts
      books/route.ts
  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
```

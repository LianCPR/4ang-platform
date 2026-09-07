-- Migration 015: Banners table for admin-managed homepage carousel
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  button_text TEXT NOT NULL DEFAULT 'PLAY',
  link_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching active banners sorted by order
CREATE INDEX IF NOT EXISTS idx_banners_active_sort ON banners (is_active, sort_order);

-- RLS: only admins can modify, everyone can read active banners
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Public read for active banners (homepage)
CREATE POLICY "Public read active banners"
  ON banners FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins have full access to banners"
  ON banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

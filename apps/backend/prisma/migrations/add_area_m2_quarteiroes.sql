-- Migration: add area_m2 to quarteiroes
ALTER TABLE quarteiroes ADD COLUMN IF NOT EXISTS area_m2 INTEGER;

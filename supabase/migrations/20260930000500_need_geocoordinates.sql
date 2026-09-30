-- Migration: 20260930000500_need_geocoordinates.sql
-- Description: "Near me" previously compared the giver's reverse-geocoded
-- place names (e.g. "Emfuleni Local Municipality") against a need's
-- free-text location ("Vaal") as strings - which misses genuine geographic
-- proximity whenever the two don't share a word, even though the need is
-- actually well within range (Vaal sits inside Emfuleni). Storing real
-- coordinates lets the app compute actual distance instead. Coordinates are
-- set server-side (api/organization/needs POST/PATCH) by forward-geocoding
-- the need's location text via the same free Nominatim API already used for
-- reverse geocoding - best-effort, so a geocoding hiccup never blocks
-- creating/editing a need. Existing needs stay null until next edited; a
-- null-coordinate need is simply excluded from "near me" matching, same as
-- before this migration existed for it.

alter table public.needs add column if not exists latitude double precision;
alter table public.needs add column if not exists longitude double precision;

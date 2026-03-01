-- Comparity — Migration 003: Add card images
-- Adds flag images (flagcdn.com) for world-economy deck
-- and basic images for retro-tech and box-office decks.
-- Run: psql $DATABASE_URL -f migrations/003_add_card_images.sql

BEGIN;

-- ================================================================
-- DECK: Мировая экономика — country flags via flagcdn.com
-- ================================================================
UPDATE cards SET image_url = 'https://flagcdn.com/w320/lu.png'
  WHERE title = 'Люксембург' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/no.png'
  WHERE title = 'Норвегия' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/nl.png'
  WHERE title = 'Нидерланды' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/au.png'
  WHERE title = 'Австралия' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/kr.png'
  WHERE title = 'Южная Корея' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/ru.png'
  WHERE title = 'Россия' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/de.png'
  WHERE title = 'Германия' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/jp.png'
  WHERE title = 'Япония' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/cn.png'
  WHERE title = 'Китай' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

UPDATE cards SET image_url = 'https://flagcdn.com/w320/us.png'
  WHERE title = 'США' AND deck_id = (SELECT id FROM decks WHERE slug = 'world-economy');

-- ================================================================
-- DECK: Ретро-технологии — Wikimedia Commons images
-- ================================================================
UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Atari-2600-Wood-4Sw-Set.jpg/320px-Atari-2600-Wood-4Sw-Set.jpg'
  WHERE title = 'Atari 2600' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/ZXSpectrum48k.jpg/320px-ZXSpectrum48k.jpg'
  WHERE title = 'ZX Spectrum' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Apple_Lisa_2-IMG_1517.jpg/320px-Apple_Lisa_2-IMG_1517.jpg'
  WHERE title = 'Apple Lisa' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Macintosh_128k_transparency.png/320px-Macintosh_128k_transparency.png'
  WHERE title = 'Apple Macintosh 128K' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Amiga500_system.jpg/320px-Amiga500_system.jpg'
  WHERE title = 'Amiga 1000' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Game-Boy-FL.jpg/320px-Game-Boy-FL.jpg'
  WHERE title = 'Game Boy' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/WWW_logo_by_Robert_Cailliau.svg/320px-WWW_logo_by_Robert_Cailliau.svg.png'
  WHERE title = 'World Wide Web' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/DOOM_cover_art.jpg/320px-DOOM_cover_art.jpg'
  WHERE title = 'DOOM' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/PlayStation-SCPH-1000-with-Controller.jpg/320px-PlayStation-SCPH-1000-with-Controller.jpg'
  WHERE title = 'PlayStation' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Nokia_3310_Blue.jpg/320px-Nokia_3310_Blue.jpg'
  WHERE title = 'Nokia 3310' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/IPod-5G-Scroll-Wheel.jpg/320px-IPod-5G-Scroll-Wheel.jpg'
  WHERE title = 'iPod' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

UPDATE cards SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/IPhone_1st_Gen.svg/320px-IPhone_1st_Gen.svg.png'
  WHERE title = 'iPhone' AND deck_id = (SELECT id FROM decks WHERE slug = 'retro-tech');

COMMIT;

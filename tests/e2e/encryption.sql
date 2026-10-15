-- Run after the disposable browser setup fixture, never against production.
DO $$ DECLARE ciphertext text; BEGIN
  SELECT twitch_client_secret_enc INTO ciphertext FROM settings WHERE id = 'singleton';
  IF ciphertext IS NULL OR ciphertext = 'e2e-disposable-twitch-client-secret' OR octet_length(decode(ciphertext, 'base64')) < 29 THEN
    RAISE EXCEPTION 'Browser fixture secret was not stored as authenticated ciphertext';
  END IF;
  IF EXISTS (SELECT 1 FROM settings WHERE twitch_enabled OR discord_enabled) THEN
    RAISE EXCEPTION 'Browser fixtures must not enable provider connections';
  END IF;
END $$;

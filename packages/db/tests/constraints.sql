-- Run against a disposable, migrated PostgreSQL database with psql -v ON_ERROR_STOP=1.
-- All fixture changes, including temporary helpers, are rolled back.
BEGIN;

CREATE FUNCTION pg_temp.expect_failure(statement text, expected_code text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_code THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE % for constraint test', expected_code;
END;
$$;

INSERT INTO settings (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
SELECT pg_temp.expect_failure($q$INSERT INTO settings (id) VALUES ('second-owner')$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET bot_name = '   '$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET command_prefix = ' '$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET public_description = repeat('a', 281)$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET discord_status = 'bogus'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET discord_activity_type = 'bogus'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET discord_application_id = '123'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET discord_guild_id = 'wrong'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET discord_enabled = true, discord_token_enc = NULL$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET twitch_enabled = true, bot_token_enc = NULL$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET bot_user_id = '123', bot_login = NULL$q$, '23514');
SELECT pg_temp.expect_failure($q$INSERT INTO runtime (service, state) VALUES ('other', 'connected')$q$, '23514');
SELECT pg_temp.expect_failure($q$INSERT INTO runtime (service, state) VALUES ('discord', 'bogus') ON CONFLICT (service) DO UPDATE SET state = 'bogus'$q$, '23514');
SELECT pg_temp.expect_failure($q$INSERT INTO runtime (service, state, metadata) VALUES ('discord', 'connected', '[]') ON CONFLICT (service) DO UPDATE SET metadata = '[]'$q$, '23514');

DO $$ DECLARE state_name text; BEGIN
  FOREACH state_name IN ARRAY ARRAY['starting', 'needs_setup', 'disconnected', 'connecting', 'reconnecting', 'connected', 'guild_unavailable', 'error', 'stopping', 'stopped', 'waiting', 'muted'] LOOP
    INSERT INTO runtime (service, state) VALUES ('discord', state_name)
      ON CONFLICT (service) DO UPDATE SET state = excluded.state;
    INSERT INTO runtime (service, state) VALUES ('twitch', state_name)
      ON CONFLICT (service) DO UPDATE SET state = excluded.state;
  END LOOP;
END $$;

INSERT INTO "user" (id, name, email) VALUES ('db-invariant-user', 'Constraint test', 'constraint-test@example.invalid');
SELECT pg_temp.expect_failure($q$INSERT INTO "user" (id, name, email) VALUES ('db-invariant-duplicate', 'Duplicate', 'CONSTRAINT-TEST@example.invalid')$q$, '23505');
INSERT INTO account (id, account_id, provider_id, user_id, updated_at)
VALUES ('db-invariant-account', 'provider-identity', 'google', 'db-invariant-user', now());
SELECT pg_temp.expect_failure($q$INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('db-invariant-duplicate', 'provider-identity', 'google', 'db-invariant-user', now())$q$, '23505');
-- Provider namespaces remain independent; a second provider can reuse its own ID.
INSERT INTO account (id, account_id, provider_id, user_id, updated_at)
VALUES ('db-invariant-other-provider', 'provider-identity', 'credential', 'db-invariant-user', now());
INSERT INTO session (id, token, user_id, expires_at, updated_at)
VALUES ('db-invariant-session', 'db-invariant-token', 'db-invariant-user', now() + interval '1 day', now());

SET LOCAL TIME ZONE 'America/Chicago';
UPDATE "user" SET created_at = '2026-01-02T03:04:05Z' WHERE id = 'db-invariant-user';
DO $$ BEGIN
  IF (SELECT created_at FROM "user" WHERE id = 'db-invariant-user') <> '2026-01-02T03:04:05Z'::timestamptz THEN
    RAISE EXCEPTION 'UTC instant was not preserved';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('user','account','session','verification','settings','runtime') AND data_type = 'timestamp without time zone') THEN
    RAISE EXCEPTION 'Expected all application timestamps to have time zones';
  END IF;
END $$;

DELETE FROM "user" WHERE id = 'db-invariant-user';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM account WHERE user_id = 'db-invariant-user') OR EXISTS (SELECT 1 FROM session WHERE user_id = 'db-invariant-user') THEN
    RAISE EXCEPTION 'Auth cascading delete failed';
  END IF;
  IF (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('session_expires_at_idx', 'verification_expires_at_idx', 'account_provider_account_unique', 'user_email_case_insensitive_unique')) <> 4 THEN
    RAISE EXCEPTION 'Expected production lookup and uniqueness indexes';
  END IF;
END $$;

ROLLBACK;
SELECT 'PostgreSQL constraints, auth identity, cascading delete, UTC timestamps, and indexes passed' AS result;

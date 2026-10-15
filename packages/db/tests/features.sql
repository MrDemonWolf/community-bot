-- Disposable migrated PostgreSQL only: psql -v ON_ERROR_STOP=1 -f features.sql.
-- Fixtures are invisible outside this transaction and are always rolled back.
BEGIN;
CREATE FUNCTION pg_temp.expect_failure(statement text, expected_code text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_code THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE % for feature constraint test', expected_code;
END $$;

INSERT INTO "user" (id, name, email) VALUES
  ('feature-test-user', 'Feature test', 'feature-test@example.invalid'),
  ('feature-test-other', 'Other user', 'feature-test-other@example.invalid');
INSERT INTO platform_identity (id, user_id, provider, provider_user_id, login, token_enc)
VALUES ('feature-test-twitch', 'feature-test-user', 'twitch', '123456', 'fixture', 'opaque-fixture');
SELECT pg_temp.expect_failure($q$INSERT INTO platform_identity (id,user_id,provider,provider_user_id,login,token_enc) VALUES ('duplicate-external','feature-test-other','twitch','123456','fixture','opaque')$q$, '23505');
SELECT pg_temp.expect_failure($q$INSERT INTO platform_identity (id,user_id,provider,provider_user_id,login,token_enc) VALUES ('duplicate-provider','feature-test-user','twitch','654321','fixture','opaque')$q$, '23505');
SELECT pg_temp.expect_failure($q$UPDATE platform_identity SET provider = 'google' WHERE id = 'feature-test-twitch'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE platform_identity SET provider_user_id = 'invalid' WHERE id = 'feature-test-twitch'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE platform_identity SET roles = '[{"role":"admin"}]' WHERE id = 'feature-test-twitch'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE platform_identity SET roles = 'null' WHERE id = 'feature-test-twitch'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE platform_identity SET token_enc = '' WHERE id = 'feature-test-twitch'$q$, '23514');
INSERT INTO platform_identity (id,user_id,provider,provider_user_id,login,token_enc,roles)
VALUES ('feature-test-discord','feature-test-user','discord','123456789012345678','fixture','opaque-fixture','["123456789012345679"]');

INSERT INTO permission_mapping (id,provider,source_role_id,role,scopes)
VALUES ('feature-test-mapping','twitch','moderator','moderator','["twitch"]');
SELECT pg_temp.expect_failure($q$INSERT INTO permission_mapping (id,provider,source_role_id,role) VALUES ('duplicate-mapping','twitch','moderator','moderator')$q$, '23505');
SELECT pg_temp.expect_failure($q$UPDATE permission_mapping SET role = 'owner' WHERE id = 'feature-test-mapping'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE permission_mapping SET scopes = '["other"]' WHERE id = 'feature-test-mapping'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE permission_mapping SET scopes = '{"twitch":true}' WHERE id = 'feature-test-mapping'$q$, '23514');

INSERT INTO settings (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
SELECT pg_temp.expect_failure($q$UPDATE settings SET twitch_lead_moderator_ids = '[123]'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE settings SET twitch_lead_moderator_ids = '["not-a-user-id"]'$q$, '23514');
UPDATE settings SET twitch_lead_moderator_ids = '["123456"]';

INSERT INTO feature_config (feature_id) VALUES ('fixture-feature');
SELECT pg_temp.expect_failure($q$UPDATE feature_config SET version = 0 WHERE feature_id = 'fixture-feature'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE feature_config SET config = '[]' WHERE feature_id = 'fixture-feature'$q$, '23514');

INSERT INTO reward_config (reward_id,title,cost) VALUES ('fixture-reward','Hydrate',100);
SELECT pg_temp.expect_failure($q$UPDATE reward_config SET cost = 0 WHERE reward_id = 'fixture-reward'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE reward_config SET title = repeat('a',46) WHERE reward_id = 'fixture-reward'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE reward_config SET prompt = repeat('a',201) WHERE reward_id = 'fixture-reward'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE reward_config SET chat_response = repeat('a',501) WHERE reward_id = 'fixture-reward'$q$, '23514');

INSERT INTO redemption (redemption_id,reward_id,broadcaster_id,user_id,login)
VALUES ('fixture-redemption','fixture-reward','123456','654321','viewer');
SELECT pg_temp.expect_failure($q$INSERT INTO redemption (redemption_id,reward_id,broadcaster_id,user_id,login) VALUES ('fixture-redemption','fixture-reward','123456','654321','viewer')$q$, '23505');
SELECT pg_temp.expect_failure($q$UPDATE redemption SET status = 'lost' WHERE redemption_id = 'fixture-redemption'$q$, '23514');
SELECT pg_temp.expect_failure($q$UPDATE redemption SET action_state = 'unknown' WHERE redemption_id = 'fixture-redemption'$q$, '23514');
DO $$ DECLARE claimed integer; BEGIN
  UPDATE redemption SET action_state = 'processing' WHERE redemption_id = 'fixture-redemption' AND action_state = 'pending';
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed <> 1 THEN RAISE EXCEPTION 'First redemption claim should succeed'; END IF;
  UPDATE redemption SET action_state = 'processing' WHERE redemption_id = 'fixture-redemption' AND action_state = 'pending';
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed <> 0 THEN RAISE EXCEPTION 'Redemption must not be claimed twice'; END IF;
END $$;

DELETE FROM "user" WHERE id = 'feature-test-user';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_identity WHERE user_id = 'feature-test-user') THEN RAISE EXCEPTION 'Platform identity cascade failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'redemption_status_received_idx') THEN RAISE EXCEPTION 'Missing redemption queue index'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('platform_identity','permission_mapping','feature_config','redemption','reward_config') AND data_type = 'timestamp without time zone') THEN RAISE EXCEPTION 'Feature timestamps must retain timezone'; END IF;
END $$;
ROLLBACK;
SELECT 'Platform identity, scoped mapping, feature/reward configuration, redemption deduplication and claim checks passed' AS result;

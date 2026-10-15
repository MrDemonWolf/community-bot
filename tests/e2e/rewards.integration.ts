import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

assert.equal(process.env.REWARDS_TEST, "true", "Use only a disposable PostgreSQL fixture database");
assert.equal(process.env.NODE_ENV, "development");
const { db } = await import("../../packages/db/src/index");
const { recordRedemption, getPendingRedemptions, claimRedemption, completeRedemption } = await import("../../packages/db/src/features");
const { getSettings } = await import("../../packages/db/src/settings");
const settings = await getSettings();
assert.ok(!settings.twitchEnabled && !settings.discordEnabled, "Workers must remain disabled");
const prefix = randomUUID();
const broadcasterId = "987654321012345678";
const manualReward = prefix + "-manual";
const actionReward = prefix + "-action";
const ids = Array.from({ length: 51 }, (_, i) => prefix + "-manual-" + i);
const actionId = prefix + "-action";
const failedId = prefix + "-failed";
const foreignId = prefix + "-foreign";
const allIds = [...ids, actionId, failedId, foreignId];
const base = { broadcasterId, userId: "123456", login: "fixture-viewer", status: "pending" as const, input: "fixture" };

try {
  await db.$client.query('INSERT INTO reward_config (reward_id,title,cost,chat_response) VALUES ($1,\'Manual fixture\',1,NULL),($2,\'Action fixture\',1,\'Hello {user}\')', [manualReward, actionReward]);
  await db.$client.query('INSERT INTO redemption (redemption_id,reward_id,broadcaster_id,user_id,login,received_at) SELECT unnest($1::text[]),$2,$3,\'123456\',\'fixture-viewer\',now()-interval \'1 minute\'', [ids, manualReward, broadcasterId]);
  assert.equal(await recordRedemption({ ...base, redemptionId: actionId, rewardId: actionReward }), true);
  assert.equal(await recordRedemption({ ...base, redemptionId: actionId, rewardId: actionReward }), false, "Event redelivery must deduplicate");
  await recordRedemption({ ...base, broadcasterId: "999", redemptionId: foreignId, rewardId: actionReward });
  const pending = await getPendingRedemptions(broadcasterId, [actionReward]);
  assert.deepEqual(pending.map((row) => row.redemptionId), [actionId], "51 earlier manual rewards cannot starve actionable work or cross creator boundaries");
  const claims = await Promise.all([claimRedemption(actionId), claimRedemption(actionId)]);
  assert.equal(claims.filter(Boolean).length, 1, "Concurrent action claims must have exactly one winner");
  const sent = await completeRedemption(actionId, "sent", "fulfilled");
  assert.equal(sent?.status, "fulfilled");
  assert.equal(sent?.actionState, "sent");
  assert.equal(await claimRedemption(actionId), null, "Completed actions cannot run again");
  assert.equal(await completeRedemption(actionId, "failed"), null, "A late completion cannot overwrite the first result");
  await recordRedemption({ ...base, redemptionId: failedId, rewardId: actionReward });
  assert.ok(await claimRedemption(failedId));
  assert.equal((await completeRedemption(failedId, "failed"))?.actionState, "failed");
  assert.equal(await claimRedemption(failedId), null, "Uncertain sends must not retry automatically");
  assert.deepEqual(await getPendingRedemptions(broadcasterId, [actionReward]), []);
  assert.equal((await db.$client.query('SELECT count(*)::int AS count FROM redemption WHERE reward_id=$1 AND status=\'pending\'', [manualReward])).rows[0].count, 51, "Manual redemption queue must remain intact");
  console.log("Redemption deduplication, actionable queue filtering, concurrent claims, terminal actions and creator isolation passed");
} finally {
  await db.$client.query('DELETE FROM redemption WHERE redemption_id=ANY($1::text[])', [allIds]);
  await db.$client.query('DELETE FROM reward_config WHERE reward_id=ANY($1::text[])', [[manualReward, actionReward]]);
  await db.$client.end();
}

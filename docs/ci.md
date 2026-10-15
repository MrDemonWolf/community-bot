# CI and Docker browser tests

Every pull request and push to main runs TypeScript checks, unit tests, and all application builds. A second job builds the real production web and worker images and runs a disposable Docker stack with PostgreSQL. No production credentials are used.

The Docker job applies incremental migrations, checks real PostgreSQL constraints, runs mocked-provider permission and identity-link integration tests, then opens the application in Chromium. Browser tests use the actual local development login and session cookie. They cover anonymous access, guided setup, invalid form submissions, secret-free RPC projections, feature controls, explicit role mappings, Channel Points authorization requirements, public-page opt-in, and mobile overflow. The mobile journey also runs in WebKit with an iPhone 13 touch profile; physical-device installation still needs a separate check.

The production web container is tested with `DEV_LOGIN=true` deliberately set: production must still refuse the development endpoint and omit the development login button.

Playwright is pinned to `1.64.1`, matching `mcr.microsoft.com/playwright:v1.64.1-noble`. The official image supplies Chromium, WebKit, and their OS dependencies. Both projects run sequentially with one worker. Browser navigation to external providers is blocked; OAuth redirects are checked without following them. These checks do not authorize any Twitch or Discord account.

## Run locally

Use a dedicated Compose project and disposable credentials. The following environment file is untracked; provide the bootstrap values from `.env.example` without any real integration credentials. A fresh volume is required for the initial anonymous/public-page assertions.

Run the commands in order and stop if any build or check fails.

```sh
for service in migrate web production-web discord twitch e2e; do
  docker --context colima-community-bot-test compose --parallel 1 --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml build "$service" || break
done
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml up -d --wait --wait-timeout 300 web production-web
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml run --rm --no-deps -e ACCESS_TEST=true -e NODE_ENV=development migrate bun tests/access.integration.ts
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml run --rm --no-deps -e REWARDS_TEST=true -e NODE_ENV=development migrate bun tests/rewards.integration.ts
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml up -d --wait --wait-timeout 180 discord twitch
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml run --rm --no-deps e2e
```

The browser container shares the web container's network namespace so that the URL stays `http://localhost:3001`, as required by the guarded development login. No web, bot, or database ports are published by this test override. Use a different project from your normal development stack.

Start real workers only after mocked provider fixtures finish and restore disabled settings. The reward integration fixture temporarily enables Channel Points in its own process; a separately running worker must not read those fake credentials.

Every browser journey records video. Successful desktop, Channel Points, and mobile views attach screenshots for visual review; failures also retain screenshots and traces in `test-results/`. The HTML report is in `playwright-report/`. CI uploads these for seven days. Fixtures use disposable secrets only.

After browser checks, CI switches only the disposable workers to their development target and tests Compose Watch. A temporary shared-source comment must synchronize into both containers and restart both healthy workers. The script restores the source, stops its watcher, and verifies that neither web container was recreated or restarted. CI also uploads the static documentation export as a seven-day `docs-preview` artifact.

After collecting results, remove only the disposable project and its database:

```sh
docker --context colima-community-bot-test compose --env-file .env.local-test -p community-bot-e2e -f compose.yaml -f compose.e2e.yaml down --volumes --remove-orphans
```

## Manual deployment

The `Deploy to Dokploy` workflow is manual and runs only on main with its confirmation checkbox selected. It requires passing CI for that exact commit. Configure the GitHub `production` environment with required reviewers and these environment secrets:

- `DOKPLOY_URL`: the HTTPS origin of your Dokploy instance.
- `DOKPLOY_API_KEY`: a deployment API credential.
- `DOKPLOY_COMPOSE_ID`: the target Compose service ID.

Configure that Dokploy service to use this repository's main branch and `compose.yaml`. Keep Dokploy's automatic Git deployments disabled if you want GitHub's checks and manual approval to be the deployment gate. Avoid configuring a second repository webhook that bypasses the gate.

The workflow checks that main has not advanced before calling Dokploy's documented `POST /api/compose.deploy` endpoint. Dokploy then queues its configured branch, which may advance after that check; this is not an immutable commit-pinned deployment. An accepted request means queued deployment, not successful rollout. Inspect the deployed commit, fresh worker heartbeats, HTTPS, and owner login afterward. Pin a known image or commit when rolling back and check migration compatibility before restoring an older version.

This repository configuration does not create GitHub secrets, enable live deployments, or modify Dokploy.

References: [Playwright Docker](https://playwright.dev/docs/docker), [Dokploy Compose deployment API](https://docs.dokploy.com/docs/api/compose), [Dokploy auto deployment](https://docs.dokploy.com/docs/core/auto-deploy).

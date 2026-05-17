# ADR-001: Auth boundary — Better-Auth owns identity

- Status: Accepted
- Date: Phase -1
- Authors: Nathanial (broadcaster)

## Context

Two viable identity systems are in scope:

1. Better-Auth (chosen scaffold default)
2. Supabase Auth (comes with our DB platform)

Both could store users + sessions + OAuth links. Running both creates split-brain identity.

## Decision

Better-Auth owns identity. Supabase Auth is disabled. Supabase Realtime + Storage + DB are used; auth is not.

Better-Auth stores users + sessions + OAuth links to Twitch + Discord in its own tables. Supabase service-role key authenticates server-side; clients hit our API (not Supabase directly).

## Consequences

- Single source of truth for identity
- Better-Auth handles 2FA, role changes, session invalidation
- Easier compliance — one place to enforce session policies
- Supabase RLS unused (we enforce auth at the tRPC layer)

* Have to set `JWT_SECRET` on Supabase to a random value we don't use (since clients never hit Supabase directly)
* Slight friction if we ever want to use Supabase RLS — would need a Better-Auth → Supabase JWT bridge

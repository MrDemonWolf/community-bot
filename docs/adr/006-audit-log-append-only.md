# ADR-006: Audit log append-only via DB trigger

- Status: Accepted
- Date: Phase -1
- Authors: Nathanial (broadcaster)

## Context

Audit log integrity matters for: GDPR accountability, internal trust between broadcaster + mods, post-incident review.

## Decision

`audit_logs` is append-only enforced at the database layer via PL/pgSQL triggers that raise on UPDATE or DELETE. Even broadcaster cannot modify rows directly. Retention is achieved by partitioning (Phase 9) and dropping old partitions, NOT row deletion.

## Consequences

+ Cannot be tampered with even by SQL injection on the app
+ Compliance: data subject access requests can include immutable audit history
- Have to use partitions for retention (more DB schema complexity)
- A truly compromised DB superuser could drop the trigger; deferred to physical-DB-access threat model (out of scope for app)

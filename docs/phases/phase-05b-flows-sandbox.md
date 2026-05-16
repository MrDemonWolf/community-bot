# Phase 5B — Flow builder (sandboxed JS)

**Goal:** Add an opt-in "Custom JS" node that runs inside `quickjs-emscripten`. Broadcaster-only publish. Tight resource limits.

---

## Scope — IN

- [ ] `quickjs-emscripten` integrated server-side
- [ ] Sandbox limits:
  - 200ms wall-clock per run
  - 16MB heap
  - No `fetch` by default; opt-in per flow with domain allowlist
  - No `eval`, no `Function` constructor, no `import`
  - No filesystem
  - No `process`, `globalThis` host bindings (manually exposed inputs only)
- [ ] Input contract: every Custom JS node receives `{ trigger, prevNodeOutput, flowContext }` and must return JSON-serializable value
- [ ] Publish-time security check: only broadcaster role can publish a flow containing a Custom JS node
- [ ] Per-flow allowlist for fetch domains (config form)
- [ ] Test runner inside dashboard: paste JS, mock inputs, see output
- [ ] Audit log captures: input hash, output hash, runtime ms, peak memory

## Scope — OUT

- ❌ NPM imports inside sandbox (security nightmare; deferred)
- ❌ TypeScript inside sandbox (post-MVP nice-to-have)

---

## Acceptance criteria

1. Custom JS node executes within limits → returns value to next node
2. Infinite loop in JS → killed at 200ms → flow marked failed → audit captures
3. Heap blowup → killed → audit captures
4. `eval("...")` inside sandbox → throws (sandbox config blocks it)
5. Non-broadcaster cannot publish flow with Custom JS node
6. Fetch to non-allowlisted domain → throws inside sandbox

## Test plan

- Unit: each sandbox limit (timeout, heap, eval block, fs block)
- Property: random JS programs don't crash the host process
- Penetration: known sandbox-escape patterns (prototype pollution, host realm reference) — all blocked

## Run plan

Same as 5A.

---

## Risks

- **Sandbox escape** — `quickjs-emscripten` has decent track record but assume zero-days exist; host hardening (process isolation, ulimit) is defense-in-depth
- **Performance** — JS compilation isn't free; cache compiled bytecode per node version

## Definition of Done

Security review checklist passed before merge. Tag `v0.5.1-flows-sandbox`.

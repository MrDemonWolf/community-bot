# ADR-005: Flow execution

- Status: Accepted
- Date: Phase 5
- Authors: Nathanial (broadcaster)

## Decision

Ship flow execution in two sub-phases:

- **5A — Declarative-only:** Node catalog of safe primitives. JSON graph. Server executes deterministically. No code injection surface.
- **5B — Sandboxed JS:** Add a "Custom JS" node. Runs in `quickjs-emscripten` with 200ms timeout, 16MB heap, no fetch (except domain-allowlisted), no fs, no eval.

5A ships when the declarative catalog covers the Brain Cells redeem use case end-to-end. 5B ships only when 5A's surface is proven not to leak.

## Why two sub-phases?

JS sandbox is a CVE risk. Declarative-only delivers 80% of value at 0% of that risk. Phase 5B is opt-in per flow + only broadcaster can publish a flow containing custom JS.

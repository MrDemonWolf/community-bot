/**
 * Shared mock factories for tRPC router tests.
 *
 * Usage in test files:
 *
 * ```ts
 * import { vi } from "vitest";
 *
 * const mocks = vi.hoisted(() => {
 *   // Import dynamically won't work here — define inline
 *   return {
 *     mockEventBus: { publish: vi.fn() },
 *     mockLogAudit: vi.fn(),
 *   };
 * });
 * ```
 *
 * These helpers are for use OUTSIDE vi.hoisted() — in test body code.
 */

/** Creates a fake better-auth session for a given user. */
export function mockSession(userId = "user-1", name = "TestUser") {
  return {
    session: {
      user: {
        id: userId,
        name,
        image: null,
        email: "test@example.com",
      },
    },
  };
}

/** Creates a mock user DB row matching what the role middlewares expect. */
export function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    name: "TestUser",
    email: "test@example.com",
    image: null,
    role: "BROADCASTER",
    banned: false,
    createdAt: new Date("2024-01-01"),
    bannedAt: null,
    banReason: null,
    ...overrides,
  };
}

/**
 * Creates a deeply-stubbed Prisma client as a Proxy.
 * Every model access returns an object whose methods are vi.fn().
 * Must be called after vitest setup (not inside vi.hoisted).
 */
export function createMockPrisma(vi: { fn: () => any }) {
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$transaction") {
          target[prop] = vi.fn();
          target[prop].mockImplementation?.(async (ops: unknown[]) => Promise.all(ops));
        } else if (prop === "$executeRawUnsafe") {
          target[prop] = vi.fn();
        } else {
          target[prop] = new Proxy({} as Record<string, any>, {
            get(model, method: string) {
              if (!model[method]) model[method] = vi.fn();
              return model[method];
            },
          });
        }
      }
      return target[prop];
    },
  };
  return new Proxy({} as Record<string, any>, handler);
}

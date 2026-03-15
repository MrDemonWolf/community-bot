/**
 * Shared mock factories for tRPC router tests.
 *
 * Usage in test files:
 *
 * ```ts
 * import { vi } from "vitest";
 *
 * const mocks = vi.hoisted(() => {
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
 * Creates a self-chaining proxy for mocking Drizzle write operations.
 * Every property returns a vi.fn() that returns another chainable proxy.
 * Mock terminal methods (returning, where, etc.) to control return values.
 */
export function createChainProxy(vi: { fn: (...args: any[]) => any }): any {
  const fns: Record<string, any> = {};
  return new Proxy({} as any, {
    get(_, prop: string) {
      if (prop === "then") return undefined; // Not a thenable
      if (!fns[prop]) {
        fns[prop] = vi.fn().mockReturnValue(createChainProxy(vi));
      }
      return fns[prop];
    },
  });
}

/**
 * Creates a deeply-stubbed Drizzle DB client as a Proxy.
 *
 * - `db.query.<model>.<method>()` — auto-creates vi.fn() for each model method
 * - `db.insert/update/delete/select()` — returns self-chaining proxies
 * - `db.transaction(fn)` — calls fn with the mock db
 * - `db.execute()` — vi.fn()
 *
 * Must be called after vitest setup (not inside vi.hoisted).
 */
export function createMockDb(vi: { fn: (...args: any[]) => any }) {
  const queryProxy = new Proxy({} as Record<string, any>, {
    get(target, model: string) {
      if (!target[model]) {
        target[model] = new Proxy({} as Record<string, any>, {
          get(m, method: string) {
            if (!m[method]) m[method] = vi.fn();
            return m[method];
          },
        });
      }
      return target[model];
    },
  });

  const db: any = {
    query: queryProxy,
    insert: vi.fn(() => createChainProxy(vi)),
    update: vi.fn(() => createChainProxy(vi)),
    delete: vi.fn(() => createChainProxy(vi)),
    select: vi.fn(() => createChainProxy(vi)),
    transaction: vi.fn(async (fn: any) => fn(db)),
    execute: vi.fn(),
  };

  return db;
}

/**
 * @deprecated Use createMockDb instead. Kept for backwards compatibility.
 */
export function createMockPrisma(vi: { fn: (...args: any[]) => any }) {
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

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted — cannot reference variables declared later.
// Use vi.hoisted() to define mocks that need to be shared.
const mockPrisma = vi.hoisted(() => ({
  systemConfig: {
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  } }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn() }));

vi.mock("@community-bot/db", () => ({
  db: mockPrisma }));

vi.mock("../../utils/logger.js", () => ({
  default: mockLogger }));

import cleanupInactiveAccounts from "./cleanupInactiveAccounts.js";

describe("cleanupInactiveAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.query.systemConfigs.findFirst.mockResolvedValue({
      key: "broadcasterUserId",
      value: "broadcaster-123" });
  });

  it("deletes users with role USER and no recent sessions past cutoff", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);
    mockPrisma.query.users.deleteMany.mockResolvedValue({ count: 2 });

    await cleanupInactiveAccounts();

    expect(mockPrisma.query.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "USER",
          id: { not: "broadcaster-123" } }) })
    );
    expect(mockPrisma.query.users.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["user-1", "user-2"] } } });
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Cleanup",
      "Deleted 2 inactive account(s)"
    );
  });

  it("does NOT delete users with BROADCASTER/MODERATOR/LEAD_MODERATOR roles", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([]);

    await cleanupInactiveAccounts();

    expect(mockPrisma.query.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "USER" }) })
    );
  });

  it("does NOT delete the broadcaster", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([]);

    await cleanupInactiveAccounts();

    expect(mockPrisma.query.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "broadcaster-123" } }) })
    );
  });

  it("does NOT delete users with recent sessions (within 365 days)", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([]);

    await cleanupInactiveAccounts();

    const callArgs = mockPrisma.query.users.findMany.mock.calls[0][0];
    expect(callArgs.where.sessions).toEqual({
      none: { expiresAt: { gte: expect.any(Date) } } });
  });

  it("does NOT delete users created within 365 days", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([]);

    await cleanupInactiveAccounts();

    const callArgs = mockPrisma.query.users.findMany.mock.calls[0][0];
    expect(callArgs.where.createdAt).toEqual({ lt: expect.any(Date) });
  });

  it("handles empty result set gracefully", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([]);

    await cleanupInactiveAccounts();

    expect(mockPrisma.query.users.deleteMany).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Cleanup",
      "No inactive accounts to clean up"
    );
  });

  it("logs the count of deleted users", async () => {
    mockPrisma.query.users.findMany.mockResolvedValue([
      { id: "u1" },
      { id: "u2" },
      { id: "u3" },
    ]);
    mockPrisma.query.users.deleteMany.mockResolvedValue({ count: 3 });

    await cleanupInactiveAccounts();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Cleanup",
      "Deleted 3 inactive account(s)"
    );
  });
});

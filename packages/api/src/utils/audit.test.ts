import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@community-bot/db", () => ({ prisma: mockPrisma }));

import { logAudit } from "./audit";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up the user role and creates an audit log entry", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "MODERATOR" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Alice",
      action: "bot.enable",
      resourceType: "BotChannel",
      resourceId: "bc1",
    });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: true },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        userName: "Alice",
        userRole: "MODERATOR",
        action: "bot.enable",
        resourceType: "BotChannel",
        resourceId: "bc1",
      }),
    });
  });

  it("defaults to USER role when user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      userId: "missing",
      userName: "Ghost",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userRole: "USER" }),
    });
  });

  it("stores optional metadata and ipAddress", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "BROADCASTER" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Admin",
      action: "command.create",
      resourceType: "TwitchChatCommand",
      resourceId: "cmd1",
      metadata: { name: "hello" },
      ipAddress: "127.0.0.1",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { name: "hello" },
        ipAddress: "127.0.0.1",
      }),
    });
  });

  it("stores userImage when provided", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Test",
      userImage: "https://example.com/avatar.png",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userImage: "https://example.com/avatar.png",
      }),
    });
  });

  it("omits undefined optional fields", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Test",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1",
    });

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.userImage).toBeUndefined();
    expect(data.ipAddress).toBeUndefined();
    expect(data.metadata).toBeUndefined();
  });
});

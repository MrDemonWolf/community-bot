import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  } }));

vi.mock("@community-bot/db", () => ({ db: mockPrisma }));

import { logAudit } from "./audit";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up the user role and creates an audit log entry", async () => {
    mockPrisma.query.users.findFirst.mockResolvedValue({ role: "MODERATOR" });
    mockPrisma.query.auditLogs.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Alice",
      action: "bot.enable",
      resourceType: "BotChannel",
      resourceId: "bc1" });

    expect(mockPrisma.query.users.findFirst).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: true } });

    expect(mockPrisma.query.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        userName: "Alice",
        userRole: "MODERATOR",
        action: "bot.enable",
        resourceType: "BotChannel",
        resourceId: "bc1" }) });
  });

  it("defaults to USER role when user is not found", async () => {
    mockPrisma.query.users.findFirst.mockResolvedValue(null);
    mockPrisma.query.auditLogs.create.mockResolvedValue({});

    await logAudit({
      userId: "missing",
      userName: "Ghost",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    expect(mockPrisma.query.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userRole: "USER" }) });
  });

  it("stores optional metadata and ipAddress", async () => {
    mockPrisma.query.users.findFirst.mockResolvedValue({ role: "BROADCASTER" });
    mockPrisma.query.auditLogs.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Admin",
      action: "command.create",
      resourceType: "TwitchChatCommand",
      resourceId: "cmd1",
      metadata: { name: "hello" },
      ipAddress: "127.0.0.1" });

    expect(mockPrisma.query.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { name: "hello" },
        ipAddress: "127.0.0.1" }) });
  });

  it("stores userImage when provided", async () => {
    mockPrisma.query.users.findFirst.mockResolvedValue({ role: "USER" });
    mockPrisma.query.auditLogs.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Test",
      userImage: "https://example.com/avatar.png",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    expect(mockPrisma.query.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userImage: "https://example.com/avatar.png" }) });
  });

  it("omits undefined optional fields", async () => {
    mockPrisma.query.users.findFirst.mockResolvedValue({ role: "USER" });
    mockPrisma.query.auditLogs.create.mockResolvedValue({});

    await logAudit({
      userId: "u1",
      userName: "Test",
      action: "test.action",
      resourceType: "Test",
      resourceId: "t1" });

    const data = mockPrisma.query.auditLogs.create.mock.calls[0][0].data;
    expect(data.userImage).toBeUndefined();
    expect(data.ipAddress).toBeUndefined();
    expect(data.metadata).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  addRequest: vi.fn(),
  removeRequest: vi.fn(),
  removeByUser: vi.fn(),
  skipRequest: vi.fn(),
  listRequests: vi.fn(),
  currentRequest: vi.fn(),
  clearRequests: vi.fn(),
  getQueueCount: vi.fn(),
  listPlaylists: vi.fn(),
  activatePlaylist: vi.fn(),
  lookupVideo: vi.fn(),
  isYouTubeEnabled: vi.fn(),
  formatDuration: vi.fn(),
}));

vi.mock("../services/songRequestManager.js", () => ({
  addRequest: mocks.addRequest,
  removeRequest: mocks.removeRequest,
  removeByUser: mocks.removeByUser,
  skipRequest: mocks.skipRequest,
  listRequests: mocks.listRequests,
  currentRequest: mocks.currentRequest,
  clearRequests: mocks.clearRequests,
  getQueueCount: mocks.getQueueCount,
  listPlaylists: mocks.listPlaylists,
  activatePlaylist: mocks.activatePlaylist,
}));
vi.mock("../services/youtubeService.js", () => ({
  lookupVideo: mocks.lookupVideo,
  isYouTubeEnabled: mocks.isYouTubeEnabled,
  formatDuration: mocks.formatDuration,
}));

import { sr } from "./sr.js";

function makeMockMsg(isMod = false) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("sr command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isYouTubeEnabled.mockReturnValue(false);
  });

  it("shows usage with no args", async () => {
    await sr.execute(client, "#ch", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("usage"));
  });

  it("requests a song without YouTube", async () => {
    mocks.addRequest.mockResolvedValue({ ok: true, position: 1 });
    await sr.execute(client, "#ch", "user", ["Never", "Gonna", "Give"], makeMockMsg());
    expect(mocks.addRequest).toHaveBeenCalledWith("#ch", "Never Gonna Give", "user", expect.anything(), undefined);
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("position 1"));
  });

  it("requests a song with YouTube metadata", async () => {
    mocks.isYouTubeEnabled.mockReturnValue(true);
    mocks.lookupVideo.mockResolvedValue({
      videoId: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up",
      duration: 213,
      thumbnail: "https://img.youtube.com/thumb.jpg",
      channelName: "Rick Astley",
    });
    mocks.formatDuration.mockReturnValue("3:33");
    mocks.addRequest.mockResolvedValue({ ok: true, position: 1 });

    await sr.execute(client, "#ch", "user", ["Never", "Gonna"], makeMockMsg());
    expect(mocks.lookupVideo).toHaveBeenCalledWith("Never Gonna");
    expect(mocks.addRequest).toHaveBeenCalledWith(
      "#ch",
      "Rick Astley - Never Gonna Give You Up",
      "user",
      expect.anything(),
      expect.objectContaining({ videoId: "dQw4w9WgXcQ" })
    );
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("[3:33]"));
  });

  it("shows error when request fails", async () => {
    mocks.addRequest.mockResolvedValue({ ok: false, reason: "Queue is full." });
    await sr.execute(client, "#ch", "user", ["Song"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", "@user, Queue is full.");
  });

  it("lists songs with duration", async () => {
    mocks.listRequests.mockResolvedValue([
      { position: 1, title: "Song A", requestedBy: "user1", youtubeVideoId: null, youtubeDuration: 180 },
      { position: 2, title: "Song B", requestedBy: "user2", youtubeVideoId: null, youtubeDuration: null },
    ]);
    mocks.getQueueCount.mockResolvedValue(2);
    mocks.formatDuration.mockReturnValue("3:00");
    await sr.execute(client, "#ch", "user", ["list"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Song A"));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("[3:00]"));
  });

  it("shows empty queue for list", async () => {
    mocks.listRequests.mockResolvedValue([]);
    await sr.execute(client, "#ch", "user", ["list"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("empty"));
  });

  it("shows current song with YouTube link", async () => {
    mocks.currentRequest.mockResolvedValue({
      title: "Song A", requestedBy: "user1", youtubeVideoId: "abc123", youtubeDuration: 200,
    });
    mocks.formatDuration.mockReturnValue("3:20");
    await sr.execute(client, "#ch", "user", ["current"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("youtu.be/abc123"));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("[3:20]"));
  });

  it("shows no current song", async () => {
    mocks.currentRequest.mockResolvedValue(null);
    await sr.execute(client, "#ch", "user", ["current"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("no song"));
  });

  it("skips song as mod", async () => {
    mocks.skipRequest.mockResolvedValue({ title: "Song A", requestedBy: "user1", autoPlaySong: null });
    await sr.execute(client, "#ch", "user", ["skip"], makeMockMsg(true));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("skipped"));
  });

  it("announces auto-play after skip", async () => {
    mocks.skipRequest.mockResolvedValue({
      title: "Song A",
      requestedBy: "user1",
      autoPlaySong: { title: "Playlist Song B", youtubeVideoId: null },
    });
    await sr.execute(client, "#ch", "user", ["skip"], makeMockMsg(true));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Now playing from playlist: Playlist Song B"));
  });

  it("rejects skip from non-mod", async () => {
    await sr.execute(client, "#ch", "user", ["skip"], makeMockMsg(false));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("only moderators"));
    expect(mocks.skipRequest).not.toHaveBeenCalled();
  });

  it("removes by position as mod", async () => {
    mocks.removeRequest.mockResolvedValue(true);
    await sr.execute(client, "#ch", "user", ["remove", "2"], makeMockMsg(true));
    expect(mocks.removeRequest).toHaveBeenCalledWith("#ch", 2);
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("removed song at position 2"));
  });

  it("removes own songs as viewer", async () => {
    mocks.removeByUser.mockResolvedValue(1);
    await sr.execute(client, "#ch", "user", ["remove"], makeMockMsg(false));
    expect(mocks.removeByUser).toHaveBeenCalledWith("#ch", "user");
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("removed 1"));
  });

  it("clears queue as mod", async () => {
    await sr.execute(client, "#ch", "user", ["clear"], makeMockMsg(true));
    expect(mocks.clearRequests).toHaveBeenCalledWith("#ch");
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("cleared"));
  });

  it("rejects clear from non-mod", async () => {
    await sr.execute(client, "#ch", "user", ["clear"], makeMockMsg(false));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("only moderators"));
    expect(mocks.clearRequests).not.toHaveBeenCalled();
  });

  describe("playlist subcommand", () => {
    it("lists available playlists", async () => {
      mocks.listPlaylists.mockResolvedValue([
        { id: "p1", name: "Chill" },
        { id: "p2", name: "Hype" },
      ]);
      await sr.execute(client, "#ch", "user", ["playlist", "list"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Chill"));
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Hype"));
    });

    it("shows no playlists message", async () => {
      mocks.listPlaylists.mockResolvedValue([]);
      await sr.execute(client, "#ch", "user", ["playlist"], makeMockMsg());
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("no playlists"));
    });

    it("activates a playlist as mod", async () => {
      mocks.activatePlaylist.mockResolvedValue(true);
      await sr.execute(client, "#ch", "user", ["playlist", "Chill", "Vibes"], makeMockMsg(true));
      expect(mocks.activatePlaylist).toHaveBeenCalledWith("#ch", "Chill Vibes");
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("activated"));
    });

    it("rejects playlist activation from non-mod", async () => {
      await sr.execute(client, "#ch", "user", ["playlist", "Chill"], makeMockMsg(false));
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("only moderators"));
    });

    it("shows not found when playlist doesn't exist", async () => {
      mocks.activatePlaylist.mockResolvedValue(false);
      await sr.execute(client, "#ch", "user", ["playlist", "Unknown"], makeMockMsg(true));
      expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("not found"));
    });
  });
});

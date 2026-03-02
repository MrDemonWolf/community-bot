import { EmbedBuilder, ChannelType } from "discord.js";
import type {
  GuildChannel,
  DMChannel,
  NonThreadGuildBasedChannel,
  Role,
  VoiceState,
} from "discord.js";

const COLOR_CREATE = 0x2ecc71; // green
const COLOR_DELETE = 0xe74c3c; // red
const COLOR_UPDATE = 0xf39c12; // amber
const COLOR_VOICE = 0x3498db; // blue

// ── Channel Events ──────────────────────────────────────────

function channelTypeName(type: ChannelType): string {
  const map: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]: "Text",
    [ChannelType.GuildVoice]: "Voice",
    [ChannelType.GuildCategory]: "Category",
    [ChannelType.GuildAnnouncement]: "Announcement",
    [ChannelType.GuildStageVoice]: "Stage",
    [ChannelType.GuildForum]: "Forum",
    [ChannelType.GuildMedia]: "Media",
  };
  return map[type] ?? "Unknown";
}

export function channelCreateEmbed(
  channel: NonThreadGuildBasedChannel
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Channel Created")
    .setColor(COLOR_CREATE)
    .addFields(
      { name: "Channel", value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true },
      { name: "Type", value: channelTypeName(channel.type), inline: true }
    )
    .setTimestamp();
}

export function channelDeleteEmbed(
  channel: GuildChannel | DMChannel
): EmbedBuilder {
  const name = "name" in channel ? channel.name : "DM";
  const type = "type" in channel ? channelTypeName(channel.type) : "DM";

  return new EmbedBuilder()
    .setTitle("Channel Deleted")
    .setColor(COLOR_DELETE)
    .addFields(
      { name: "Channel", value: `\`${name}\``, inline: true },
      { name: "Type", value: type, inline: true }
    )
    .setTimestamp();
}

export function channelUpdateEmbed(
  oldChannel: GuildChannel | DMChannel,
  newChannel: GuildChannel | DMChannel
): EmbedBuilder | null {
  if (!("name" in oldChannel) || !("name" in newChannel)) return null;

  const changes: { name: string; value: string }[] = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push({
      name: "Name",
      value: `\`${oldChannel.name}\` → \`${newChannel.name}\``,
    });
  }

  if (
    "topic" in oldChannel &&
    "topic" in newChannel &&
    oldChannel.topic !== newChannel.topic
  ) {
    changes.push({
      name: "Topic",
      value: `${oldChannel.topic || "(none)"} → ${newChannel.topic || "(none)"}`,
    });
  }

  if (
    "nsfw" in oldChannel &&
    "nsfw" in newChannel &&
    oldChannel.nsfw !== newChannel.nsfw
  ) {
    changes.push({
      name: "NSFW",
      value: `${oldChannel.nsfw} → ${newChannel.nsfw}`,
    });
  }

  if (
    "rateLimitPerUser" in oldChannel &&
    "rateLimitPerUser" in newChannel &&
    oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
  ) {
    changes.push({
      name: "Slowmode",
      value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`,
    });
  }

  if (changes.length === 0) return null;

  return new EmbedBuilder()
    .setTitle("Channel Updated")
    .setColor(COLOR_UPDATE)
    .setDescription(`<#${newChannel.id}> (\`${newChannel.name}\`)`)
    .addFields(changes)
    .setTimestamp();
}

// ── Role Events ─────────────────────────────────────────────

function colorHex(color: number): string {
  return color === 0 ? "Default" : `#${color.toString(16).padStart(6, "0")}`;
}

export function roleCreateEmbed(role: Role): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Role Created")
    .setColor(COLOR_CREATE)
    .addFields(
      { name: "Role", value: `<@&${role.id}> (\`${role.name}\`)`, inline: true },
      { name: "Color", value: colorHex(role.color), inline: true },
      { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true }
    )
    .setTimestamp();
}

export function roleDeleteEmbed(role: Role): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Role Deleted")
    .setColor(COLOR_DELETE)
    .addFields(
      { name: "Role", value: `\`${role.name}\``, inline: true },
      { name: "Color", value: colorHex(role.color), inline: true }
    )
    .setTimestamp();
}

export function roleUpdateEmbed(
  oldRole: Role,
  newRole: Role
): EmbedBuilder | null {
  const changes: { name: string; value: string }[] = [];

  if (oldRole.name !== newRole.name) {
    changes.push({
      name: "Name",
      value: `\`${oldRole.name}\` → \`${newRole.name}\``,
    });
  }

  if (oldRole.color !== newRole.color) {
    changes.push({
      name: "Color",
      value: `${colorHex(oldRole.color)} → ${colorHex(newRole.color)}`,
    });
  }

  if (oldRole.hoist !== newRole.hoist) {
    changes.push({
      name: "Hoisted",
      value: `${oldRole.hoist ? "Yes" : "No"} → ${newRole.hoist ? "Yes" : "No"}`,
    });
  }

  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push({
      name: "Mentionable",
      value: `${oldRole.mentionable ? "Yes" : "No"} → ${newRole.mentionable ? "Yes" : "No"}`,
    });
  }

  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    changes.push({
      name: "Permissions",
      value: "Permission flags changed",
    });
  }

  if (changes.length === 0) return null;

  return new EmbedBuilder()
    .setTitle("Role Updated")
    .setColor(COLOR_UPDATE)
    .setDescription(`<@&${newRole.id}> (\`${newRole.name}\`)`)
    .addFields(changes)
    .setTimestamp();
}

// ── Voice Events ────────────────────────────────────────────

export function voiceStateUpdateEmbed(
  oldState: VoiceState,
  newState: VoiceState
): EmbedBuilder | null {
  const user = newState.member?.user;
  if (!user) return null;

  const userTag = `<@${user.id}>`;

  // Joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    return new EmbedBuilder()
      .setTitle("Voice Join")
      .setColor(COLOR_VOICE)
      .setDescription(`${userTag} joined <#${newState.channelId}>`)
      .setTimestamp();
  }

  // Left a voice channel
  if (oldState.channelId && !newState.channelId) {
    return new EmbedBuilder()
      .setTitle("Voice Leave")
      .setColor(COLOR_VOICE)
      .setDescription(`${userTag} left <#${oldState.channelId}>`)
      .setTimestamp();
  }

  // Switched voice channels
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    return new EmbedBuilder()
      .setTitle("Voice Move")
      .setColor(COLOR_VOICE)
      .setDescription(
        `${userTag} moved from <#${oldState.channelId}> to <#${newState.channelId}>`
      )
      .setTimestamp();
  }

  // Mute/deafen state changes
  const changes: string[] = [];

  if (oldState.selfMute !== newState.selfMute) {
    changes.push(
      newState.selfMute ? "self-muted" : "self-unmuted"
    );
  }

  if (oldState.selfDeaf !== newState.selfDeaf) {
    changes.push(
      newState.selfDeaf ? "self-deafened" : "self-undeafened"
    );
  }

  if (oldState.serverMute !== newState.serverMute) {
    changes.push(
      newState.serverMute ? "server muted" : "server unmuted"
    );
  }

  if (oldState.serverDeaf !== newState.serverDeaf) {
    changes.push(
      newState.serverDeaf ? "server deafened" : "server undeafened"
    );
  }

  if (oldState.streaming !== newState.streaming) {
    changes.push(
      newState.streaming ? "started streaming" : "stopped streaming"
    );
  }

  if (changes.length === 0) return null;

  const channel = newState.channelId ?? oldState.channelId;

  return new EmbedBuilder()
    .setTitle("Voice State Update")
    .setColor(COLOR_VOICE)
    .setDescription(
      `${userTag} in <#${channel}>: ${changes.join(", ")}`
    )
    .setTimestamp();
}

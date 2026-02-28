import { EmbedBuilder } from "discord.js";

export interface TemplateVariables {
  [key: string]: string | undefined;
}

export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = variables[key];
    return value !== undefined ? value : match;
  });
}

interface CustomEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface CustomEmbedJson {
  author?: { name?: string; icon_url?: string; url?: string };
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: CustomEmbedField[];
  thumbnail?: { url?: string };
  image?: { url?: string };
  footer?: { text?: string; icon_url?: string };
  timestamp?: string;
}

export function buildCustomEmbed(
  customJson: string,
  variables: TemplateVariables
): EmbedBuilder | null {
  if (!customJson || customJson.trim() === "") return null;

  let parsed: CustomEmbedJson;
  try {
    parsed = JSON.parse(customJson) as CustomEmbedJson;
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const replace = (s: string | undefined) =>
    s ? replaceTemplateVariables(s, variables) : undefined;

  const embed = new EmbedBuilder();

  if (parsed.author?.name) {
    embed.setAuthor({
      name: replace(parsed.author.name)!,
      iconURL: replace(parsed.author.icon_url),
      url: replace(parsed.author.url),
    });
  }

  if (parsed.title) embed.setTitle(replace(parsed.title)!);
  if (parsed.url) embed.setURL(replace(parsed.url)!);
  if (parsed.description) embed.setDescription(replace(parsed.description)!);
  if (parsed.color !== undefined) embed.setColor(parsed.color);
  if (parsed.thumbnail?.url) embed.setThumbnail(replace(parsed.thumbnail.url)!);
  if (parsed.image?.url) embed.setImage(replace(parsed.image.url)!);

  if (parsed.footer?.text) {
    embed.setFooter({
      text: replace(parsed.footer.text)!,
      iconURL: replace(parsed.footer.icon_url),
    });
  }

  if (parsed.fields && Array.isArray(parsed.fields)) {
    embed.addFields(
      parsed.fields.map((f) => ({
        name: replace(f.name) ?? "",
        value: replace(f.value) ?? "",
        inline: f.inline ?? false,
      }))
    );
  }

  if (parsed.timestamp) embed.setTimestamp(new Date(parsed.timestamp));

  return embed;
}

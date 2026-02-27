"use client";

export interface ParsedEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface ParsedEmbed {
  author?: { name?: string; icon_url?: string; url?: string };
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: ParsedEmbedField[];
  thumbnail?: { url?: string };
  image?: { url?: string };
  footer?: { text?: string; icon_url?: string };
  timestamp?: string;
}

export function parseEmbedJson(json: string): ParsedEmbed | null {
  if (!json || json.trim() === "") return null;

  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ParsedEmbed;
  } catch {
    return null;
  }
}

function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function EmbedPreview({
  json,
  variables,
}: {
  json: string;
  variables?: Record<string, string>;
}) {
  const embed = parseEmbedJson(json);

  if (!embed) {
    return (
      <div className="rounded border border-border bg-surface-raised p-4 text-sm text-muted-foreground">
        {json && json.trim() !== ""
          ? "Invalid JSON — preview unavailable"
          : "Enter embed JSON to see preview"}
      </div>
    );
  }

  const replace = (s: string | undefined) => {
    if (!s || !variables) return s;
    return s.replace(/\{(\w+)\}/g, (match, key: string) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  };

  const borderColor = embed.color !== undefined ? colorToHex(embed.color) : "#1f2937";

  return (
    <div
      className="max-w-md overflow-hidden rounded border-l-4 bg-[#2b2d31] p-4 text-sm text-[#dbdee1]"
      style={{ borderLeftColor: borderColor }}
    >
      {/* Author */}
      {embed.author?.name && (
        <div className="mb-1 flex items-center gap-2 text-xs font-medium">
          {embed.author.icon_url && (
            <div className="size-5 rounded-full bg-[#3f4147]" />
          )}
          <span>{replace(embed.author.name)}</span>
        </div>
      )}

      {/* Title */}
      {embed.title && (
        <div className="mb-1 font-semibold text-[#00a8fc]">
          {replace(embed.title)}
        </div>
      )}

      {/* Description */}
      {embed.description && (
        <div className="mb-2 text-sm whitespace-pre-wrap">
          {replace(embed.description)}
        </div>
      )}

      {/* Fields */}
      {embed.fields && embed.fields.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {embed.fields.map((f, i) => (
            <div
              key={i}
              className={f.inline ? "col-span-1" : "col-span-3"}
            >
              <div className="text-xs font-semibold text-[#b5bac1]">
                {replace(f.name)}
              </div>
              <div className="text-sm">{replace(f.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Image */}
      {embed.image?.url && (
        <div className="mb-2 h-40 rounded bg-[#3f4147] text-xs text-[#b5bac1] flex items-center justify-center">
          Image: {replace(embed.image.url)}
        </div>
      )}

      {/* Thumbnail placeholder (positioned right) */}
      {embed.thumbnail?.url && (
        <div className="float-right ml-4 mb-2 size-16 rounded bg-[#3f4147]" />
      )}

      {/* Footer */}
      {embed.footer?.text && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#b5bac1]">
          {embed.footer.icon_url && (
            <div className="size-4 rounded-full bg-[#3f4147]" />
          )}
          <span>{replace(embed.footer.text)}</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { EmbedPreview } from "@/app/(dashboard)/dashboard/discord/embed-preview";
import type { ParsedEmbed } from "@/app/(dashboard)/dashboard/discord/embed-preview";
import { parseEmbedJson } from "@/app/(dashboard)/dashboard/discord/embed-preview";
import { EmbedBuilderForm, createEmptyFormState } from "./embed-builder-form";
import type { EmbedFormState } from "./embed-builder-form";
import { TemplateVariablePills } from "./template-variable-pills";
import { JsonImportExport } from "./json-import-export";

interface EmbedBuilderProps {
  value: string;
  onChange: (json: string) => void;
  variables?: Record<string, string>;
  previewVariables?: Record<string, string>;
  className?: string;
  compact?: boolean;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function intToHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function parsedEmbedToFormState(embed: ParsedEmbed): EmbedFormState {
  return {
    title: embed.title ?? "",
    url: embed.url ?? "",
    description: embed.description ?? "",
    color:
      embed.color !== undefined ? intToHex(embed.color) : "",
    authorName: embed.author?.name ?? "",
    authorIconUrl: embed.author?.icon_url ?? "",
    authorUrl: embed.author?.url ?? "",
    thumbnailUrl: embed.thumbnail?.url ?? "",
    imageUrl: embed.image?.url ?? "",
    footerText: embed.footer?.text ?? "",
    footerIconUrl: embed.footer?.icon_url ?? "",
    useTimestamp: !!embed.timestamp,
    fields: (embed.fields ?? []).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })),
  };
}

function formStateToJson(state: EmbedFormState): string {
  const embed: Record<string, unknown> = {};

  if (state.title) embed.title = state.title;
  if (state.url) embed.url = state.url;
  if (state.description) embed.description = state.description;
  if (state.color && /^#[0-9A-Fa-f]{6}$/.test(state.color)) {
    embed.color = hexToInt(state.color);
  }

  if (state.authorName || state.authorIconUrl || state.authorUrl) {
    const author: Record<string, string> = {};
    if (state.authorName) author.name = state.authorName;
    if (state.authorIconUrl) author.icon_url = state.authorIconUrl;
    if (state.authorUrl) author.url = state.authorUrl;
    embed.author = author;
  }

  const filledFields = state.fields.filter((f) => f.name || f.value);
  if (filledFields.length > 0) {
    embed.fields = filledFields.map((f) => ({
      name: f.name,
      value: f.value,
      ...(f.inline ? { inline: true } : {}),
    }));
  }

  if (state.thumbnailUrl) embed.thumbnail = { url: state.thumbnailUrl };
  if (state.imageUrl) embed.image = { url: state.imageUrl };

  if (state.footerText || state.footerIconUrl) {
    const footer: Record<string, string> = {};
    if (state.footerText) footer.text = state.footerText;
    if (state.footerIconUrl) footer.icon_url = state.footerIconUrl;
    embed.footer = footer;
  }

  if (state.useTimestamp) {
    embed.timestamp = new Date().toISOString();
  }

  if (Object.keys(embed).length === 0) return "";
  return JSON.stringify(embed, null, 2);
}

export function EmbedBuilder({
  value,
  onChange,
  variables,
  previewVariables,
  className,
  compact,
}: EmbedBuilderProps) {
  const [formState, setFormState] = useState<EmbedFormState>(() => {
    const parsed = parseEmbedJson(value);
    return parsed ? parsedEmbedToFormState(parsed) : createEmptyFormState();
  });

  // Track whether the change came from the form to avoid loops
  const isInternalChange = useRef(false);

  // Sync external value changes into form state
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const parsed = parseEmbedJson(value);
    if (parsed) {
      setFormState(parsedEmbedToFormState(parsed));
    } else if (!value || value.trim() === "") {
      setFormState(createEmptyFormState());
    }
  }, [value]);

  const handleFormChange = useCallback(
    (newState: EmbedFormState) => {
      setFormState(newState);
      isInternalChange.current = true;
      const json = formStateToJson(newState);
      onChange(json);
    },
    [onChange]
  );

  const handleJsonImport = useCallback(
    (json: string) => {
      if (!json.trim()) {
        setFormState(createEmptyFormState());
        isInternalChange.current = true;
        onChange("");
        return;
      }
      const parsed = parseEmbedJson(json);
      if (parsed) {
        setFormState(parsedEmbedToFormState(parsed));
        isInternalChange.current = true;
        onChange(json);
      }
    },
    [onChange]
  );

  const currentJson = formStateToJson(formState);

  return (
    <div className={cn("space-y-3", className)}>
      {variables && Object.keys(variables).length > 0 && (
        <TemplateVariablePills variables={variables} />
      )}

      <div
        className={cn(
          "gap-4",
          compact ? "flex flex-col" : "flex flex-col md:grid md:grid-cols-[1fr_20rem]"
        )}
      >
        {/* Form */}
        <div className="min-w-0">
          <EmbedBuilderForm state={formState} onChange={handleFormChange} />
        </div>

        {/* Preview */}
        <div className={cn(compact ? "" : "md:sticky md:top-4 md:self-start")}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Preview
          </p>
          <EmbedPreview json={currentJson} variables={previewVariables} />
          <div className="mt-3">
            <JsonImportExport json={currentJson} onApply={handleJsonImport} />
          </div>
        </div>
      </div>
    </div>
  );
}

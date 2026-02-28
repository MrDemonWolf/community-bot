"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmbedColorPicker } from "./embed-color-picker";
import { EmbedFieldsManager } from "./embed-fields-manager";
import type { EmbedFieldData } from "./embed-field-row";

export interface EmbedFormState {
  title: string;
  url: string;
  description: string;
  color: string;
  authorName: string;
  authorIconUrl: string;
  authorUrl: string;
  thumbnailUrl: string;
  imageUrl: string;
  footerText: string;
  footerIconUrl: string;
  useTimestamp: boolean;
  fields: EmbedFieldData[];
}

export function createEmptyFormState(): EmbedFormState {
  return {
    title: "",
    url: "",
    description: "",
    color: "",
    authorName: "",
    authorIconUrl: "",
    authorUrl: "",
    thumbnailUrl: "",
    imageUrl: "",
    footerText: "",
    footerIconUrl: "",
    useTimestamp: false,
    fields: [],
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function EmbedBuilderForm({
  state,
  onChange,
}: {
  state: EmbedFormState;
  onChange: (state: EmbedFormState) => void;
}) {
  function set<K extends keyof EmbedFormState>(
    key: K,
    value: EmbedFormState[K]
  ) {
    onChange({ ...state, [key]: value });
  }

  return (
    <div className="space-y-1">
      {/* Basic — open by default */}
      <details open>
        <summary className="cursor-pointer py-1.5 text-xs font-semibold text-foreground">
          Basic
        </summary>
        <div className="space-y-2 pb-3 pl-2">
          <Field label="Title">
            <Input
              value={state.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Embed title"
            />
          </Field>
          <Field label="URL">
            <Input
              value={state.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Description">
            <textarea
              value={state.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Embed description (supports variables)"
              rows={3}
              className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-1 text-xs outline-none focus-visible:ring-1"
            />
          </Field>
          <Field label="Color">
            <EmbedColorPicker
              value={state.color}
              onChange={(hex) => set("color", hex)}
            />
          </Field>
        </div>
      </details>

      {/* Author */}
      <details>
        <summary className="cursor-pointer py-1.5 text-xs font-semibold text-foreground">
          Author
        </summary>
        <div className="space-y-2 pb-3 pl-2">
          <Field label="Name">
            <Input
              value={state.authorName}
              onChange={(e) => set("authorName", e.target.value)}
              placeholder="Author name"
            />
          </Field>
          <Field label="Icon URL">
            <Input
              value={state.authorIconUrl}
              onChange={(e) => set("authorIconUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="URL">
            <Input
              value={state.authorUrl}
              onChange={(e) => set("authorUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
      </details>

      {/* Fields */}
      <details open={state.fields.length > 0}>
        <summary className="cursor-pointer py-1.5 text-xs font-semibold text-foreground">
          Fields ({state.fields.length})
        </summary>
        <div className="pb-3 pl-2">
          <EmbedFieldsManager
            fields={state.fields}
            onChange={(fields) => set("fields", fields)}
          />
        </div>
      </details>

      {/* Images */}
      <details>
        <summary className="cursor-pointer py-1.5 text-xs font-semibold text-foreground">
          Images
        </summary>
        <div className="space-y-2 pb-3 pl-2">
          <Field label="Thumbnail URL">
            <Input
              value={state.thumbnailUrl}
              onChange={(e) => set("thumbnailUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Image URL">
            <Input
              value={state.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
      </details>

      {/* Footer */}
      <details>
        <summary className="cursor-pointer py-1.5 text-xs font-semibold text-foreground">
          Footer
        </summary>
        <div className="space-y-2 pb-3 pl-2">
          <Field label="Text">
            <Input
              value={state.footerText}
              onChange={(e) => set("footerText", e.target.value)}
              placeholder="Footer text"
            />
          </Field>
          <Field label="Icon URL">
            <Input
              value={state.footerIconUrl}
              onChange={(e) => set("footerIconUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Label className="mt-2 gap-2">
            <Checkbox
              checked={state.useTimestamp}
              onCheckedChange={(checked) =>
                set("useTimestamp", checked === true)
              }
            />
            <span className="text-xs text-muted-foreground">
              Include timestamp
            </span>
          </Label>
        </div>
      </details>
    </div>
  );
}

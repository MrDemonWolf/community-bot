"use client";

import { Input } from "@/components/ui/input";

const PRESET_COLORS = [
  { hex: "#5865F2", label: "Blurple" },
  { hex: "#9146FF", label: "Twitch" },
  { hex: "#00ACED", label: "Brand" },
  { hex: "#57F287", label: "Green" },
  { hex: "#FEE75C", label: "Yellow" },
  { hex: "#ED4245", label: "Red" },
  { hex: "#EB459E", label: "Fuchsia" },
  { hex: "#FFFFFF", label: "White" },
];

export function EmbedColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) {
            onChange(v);
          }
        }}
        placeholder="#000000"
        className="w-24 font-mono"
      />
      <div className="flex gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            onClick={() => onChange(c.hex)}
            className="size-5 rounded-sm border border-border transition-transform hover:scale-110"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}

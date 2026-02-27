"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, ChevronUp, ChevronDown } from "lucide-react";

export interface EmbedFieldData {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

export function EmbedFieldRow({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: EmbedFieldData;
  index: number;
  total: number;
  onChange: (updated: EmbedFieldData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex gap-2 rounded border border-border p-2">
      <div className="flex-1 space-y-1.5">
        <Input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="Field name"
        />
        <textarea
          value={field.value}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          placeholder="Field value"
          rows={2}
          className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-1 text-xs outline-none focus-visible:ring-1"
        />
        <Label className="gap-2">
          <Checkbox
            checked={field.inline}
            onCheckedChange={(checked) =>
              onChange({ ...field, inline: checked === true })
            }
          />
          <span className="text-xs text-muted-foreground">Inline</span>
        </Label>
      </div>
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={onMoveUp}
          title="Move up"
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={index === total - 1}
          onClick={onMoveDown}
          title="Move down"
        >
          <ChevronDown className="size-3" />
        </Button>
        <Button
          variant="destructive"
          size="icon-xs"
          onClick={onRemove}
          title="Remove field"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}

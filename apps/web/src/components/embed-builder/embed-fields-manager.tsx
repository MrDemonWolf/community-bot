"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EmbedFieldRow } from "./embed-field-row";
import type { EmbedFieldData } from "./embed-field-row";

const MAX_FIELDS = 25;

export function EmbedFieldsManager({
  fields,
  onChange,
}: {
  fields: EmbedFieldData[];
  onChange: (fields: EmbedFieldData[]) => void;
}) {
  function addField() {
    if (fields.length >= MAX_FIELDS) return;
    onChange([
      ...fields,
      { id: crypto.randomUUID(), name: "", value: "", inline: false },
    ]);
  }

  function updateField(index: number, updated: EmbedFieldData) {
    const next = [...fields];
    next[index] = updated;
    onChange(next);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function moveField(from: number, to: number) {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <EmbedFieldRow
          key={field.id}
          field={field}
          index={i}
          total={fields.length}
          onChange={(updated) => updateField(i, updated)}
          onRemove={() => removeField(i)}
          onMoveUp={() => moveField(i, i - 1)}
          onMoveDown={() => moveField(i, i + 1)}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addField}
        disabled={fields.length >= MAX_FIELDS}
      >
        <Plus className="size-3" />
        Add Field ({fields.length}/{MAX_FIELDS})
      </Button>
    </div>
  );
}

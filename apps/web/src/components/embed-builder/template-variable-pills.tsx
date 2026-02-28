"use client";

import { toast } from "sonner";

export function TemplateVariablePills({
  variables,
}: {
  variables: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(variables).map(([name, description]) => (
        <button
          key={name}
          type="button"
          title={`${description} — click to copy`}
          onClick={() => {
            navigator.clipboard.writeText(`{${name}}`);
            toast.success(`Copied {${name}} to clipboard`);
          }}
          className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-brand-main/10 hover:text-brand-main"
        >
          {`{${name}}`}
        </button>
      ))}
    </div>
  );
}

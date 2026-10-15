import { LoaderCircle } from "lucide-react";

export function InlineSpinner() {
  return <LoaderCircle className="inline-spinner" size={16} aria-hidden="true" />;
}

export function LoadingState({ label, kind = "cards" }: { label: string; kind?: "cards" | "form" }) {
  return <section className="loading-state" role="status" aria-live="polite">
    <p className="loading-label"><InlineSpinner />{label}</p>
    <div className={`loading-preview loading-preview-${kind}`} aria-hidden="true" aria-busy="true">
      {Array.from({ length: kind === "cards" ? 2 : 1 }, (_, index) => <div className="loading-panel" key={index}>
        <div className="skeleton skeleton-heading" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text skeleton-short" />
        {kind === "form" && <div className="skeleton skeleton-field" />}
        <div className="skeleton skeleton-control" />
      </div>)}
    </div>
  </section>;
}

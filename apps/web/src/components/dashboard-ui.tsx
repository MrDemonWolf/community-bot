import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, actions }: {
  eyebrow: string; title: ReactNode; description: ReactNode; actions?: ReactNode;
}) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span>
    <h1>{title}</h1><p>{description}</p></div>{actions && <div className="actions">{actions}</div>}</header>;
}

export function Panel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section {...props} className={className ? `panel ${className}` : "panel"} />;
}

export function StatusBadge({ children, good = false }: { children: ReactNode; good?: boolean }) {
  return <span className={good ? "status good" : "status"}>{children}</span>;
}

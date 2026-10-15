import type { ReactNode } from "react";
import PublicHeader from "@/components/public-header";

type Contents = readonly { id: string; label: string }[];

function ContentsLinks({ contents }: { contents: Contents }) {
  return <nav aria-label="On this page"><ol className="legal-contents-list">{contents.map(({ id, label }, index) =>
    <li key={id}><a href={`#${id}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{label}</a></li>,
  )}</ol></nav>;
}

export function LegalPage({ title, summary, summaryPoints, contents, children }: {
  title: string; summary: string; summaryPoints: readonly string[]; contents: Contents; children: ReactNode;
}) {
  return <>
    <PublicHeader active={title === "Privacy Policy" ? "privacy" : "terms"} />
    <main className="legal-page" id="legal-document">
      <header className="legal-heading">
        <span className="eyebrow">MrDemonWolf, Inc. · Legal</span>
        <h1>{title}</h1><p className="legal-intro">{summary}</p>
        <p className="legal-updated">Last updated <time dateTime="2026-10-15">October 15, 2026</time></p>
      </header>
      <div className="legal-layout">
        <aside className="legal-sidebar" aria-label="Document navigation">
          <span className="legal-contents-title">On this page</span><ContentsLinks contents={contents} />
          <div className="legal-contact-note"><strong>Have a question?</strong><a href="mailto:legal@mrdemonwolf.com">legal@mrdemonwolf.com</a></div>
        </aside>
        <div className="legal-reading-column">
          {/* Only navigation collapses on small screens; the policy text always stays directly readable. */}
          <details className="legal-mobile-contents"><summary>On this page <span>{contents.length} sections</span></summary><ContentsLinks contents={contents} /></details>
          <section className="legal-overview" aria-labelledby="legal-overview-title">
            <span className="eyebrow">Quick read</span><h2 id="legal-overview-title">The essentials</h2>
            <ul>{summaryPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            <p className="legal-summary-note">This summary is a guide, not a replacement for the full document below.</p>
          </section>
          <article className="legal-prose" aria-label={title}>{children}</article>
          <div className="legal-end"><span>Questions or privacy requests? <a href="mailto:legal@mrdemonwolf.com">Email our legal contact</a>.</span><a href="#legal-document">Back to top ↑</a></div>
        </div>
      </div>
    </main>
  </>;
}

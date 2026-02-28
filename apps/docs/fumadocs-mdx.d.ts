// Type declarations for fumadocs-mdx generated collections.
// The generated .source/server.ts uses @ts-nocheck and query-string
// imports that tsc cannot resolve in standalone type checking.
// This ambient module declaration provides proper types.
declare module "@/.source/server" {
  import type { Source, PageData, MetaData } from "fumadocs-core/source";

  interface FumadocsDocData extends PageData {
    body: import("mdx/types").MDXContent;
    toc: { depth: number; url: string; title: string }[];
    full?: boolean;
  }

  export const docs: {
    docs: FumadocsDocData[];
    meta: MetaData[];
    toFumadocsSource: () => Source<{
      pageData: FumadocsDocData;
      metaData: MetaData;
    }>;
  };
}

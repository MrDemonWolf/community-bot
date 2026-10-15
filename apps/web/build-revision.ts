import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHA = /^[a-f0-9]{40}$/;

export function buildRevision(root: string, fallback = process.env.SOURCE_COMMIT ?? ""): string {
  const read = (path: string) => { try { return readFileSync(path, "utf8").trim(); } catch { return ""; } };
  let git = resolve(root, ".git");
  const pointer = read(git).match(/^gitdir: (.+)$/);
  if (pointer) git = resolve(root, pointer[1]!);
  const head = read(resolve(git, "HEAD"));
  if (SHA.test(head)) return head;
  const ref = head.match(/^ref: (refs\/heads\/[\w./-]+)$/)?.[1];
  if (ref && !ref.split("/").includes("..")) {
    const common = read(resolve(git, "commondir"));
    const directory = common ? resolve(git, common) : git;
    const loose = read(resolve(directory, ref));
    if (SHA.test(loose)) return loose;
    const packed = read(resolve(directory, "packed-refs")).split("\n").find((line) => line.endsWith(` ${ref}`))?.split(" ")[0];
    if (packed && SHA.test(packed)) return packed;
  }
  // Source archives lack Git metadata. Never substitute the latest remote commit for an unknown build.
  return SHA.test(fallback) ? fallback : "";
}

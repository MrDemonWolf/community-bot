import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            from <span className="text-[hsl(280,100%,70%)]">MrDemonWOlf</span>,
            Inc.
          </h1>
        </div>
      </main>
    </HydrateClient>
  );
}

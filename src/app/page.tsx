import { Suspense } from "react";
import { TopBar } from "@/components/chrome";
import { HomeClient } from "./home-client";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <Suspense>
        <HomeClient />
      </Suspense>
      <footer className="mx-auto w-full max-w-[1100px] px-4 py-6 text-[12px] text-fg-3">21CSC302J Computer Networks · School of Computing, SRMIST</footer>
    </div>
  );
}

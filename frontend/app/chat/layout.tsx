"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex h-screen">
      {/* Slim Sidebar */}
      <aside className="z-[9999] h-full w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-4">
        {/* Home Icon */}
        <Link
          href="/"
          className="p-3 rounded-lg hover:bg-zinc-800 transition-colors group relative"
          title="Home"
        >
          <Home className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" />
          <span className="fixed left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Home
          </span>
        </Link>

        {/* Back Icon */}
        <button
          onClick={() => router.back()}
          className="p-3 rounded-lg hover:bg-zinc-800 transition-colors group relative"
          title="Go Back"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Back
          </span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Avatar, DropdownMenu } from "@radix-ui/themes";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";

export default function LoginComponent() {
  const { user, isLoading } = useAuth0Firebase();

  if (isLoading) {
    // Same footprint as the logged-out state so the navbar never shifts.
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-10 w-[4.5rem] rounded-full bg-white/[0.03]" />
        <div className="h-10 w-24 rounded-full border border-white/10 bg-white/[0.04]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        {/* "Guest" is a shortcut duplicated by the menu's Learning link, so
            it yields its space to the logo on phones. */}
        {/* Same pill for both - dark-tinted glass so they read over the
            white props without becoming heavy slabs. */}
        <Link
          href="/learning"
          className="hidden whitespace-nowrap rounded-full border border-white/15 bg-space-950/50 px-4 py-2 text-sm font-medium text-fg backdrop-blur-md transition-colors hover:border-white/30 hover:bg-space-950/70 sm:block md:px-6 md:py-2.5 md:text-base"
        >
          Guest
        </Link>
        <a
          href="/login"
          className="whitespace-nowrap rounded-full border border-white/15 bg-space-950/50 px-4 py-2 text-sm font-medium text-fg backdrop-blur-md transition-colors hover:border-white/30 hover:bg-space-950/70 md:px-6 md:py-2.5 md:text-base"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-space-950/50 py-2 pl-2 pr-5 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-space-950/70">
          <Avatar
            size="2"
            src={user.picture || ""}
            radius="full"
            fallback={user.name?.[0]?.toUpperCase() || "U"}
          />
          <span className="text-base font-medium text-white">
            {user.name ? user.name.substring(0, 12) : "Account"}
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content className="min-w-[180px]">
        <DropdownMenu.Item asChild>
          <button
            type="button"
            onClick={async () => {
              const { supabase } = await import("@/lib/supabase");
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="w-full cursor-pointer text-left text-red-500"
          >
            Log Out
          </button>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

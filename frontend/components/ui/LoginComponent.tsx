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
        <Link
          href="/learning"
          className="rounded-full px-4 py-2.5 text-base font-medium text-fg/70 transition-colors hover:text-fg"
        >
          Guest
        </Link>
        <a
          href="/login"
          className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-2.5 text-base font-medium text-fg transition-colors hover:border-white/30 hover:bg-white/[0.08]"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 py-2 pl-2 pr-5 transition-colors hover:border-white/30 hover:bg-white/10">
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
          <a href="/auth/logout" className="cursor-pointer text-red-500">
            Log Out
          </a>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

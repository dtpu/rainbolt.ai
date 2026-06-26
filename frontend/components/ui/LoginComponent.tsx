"use client";

import Link from "next/link";
import { Avatar, DropdownMenu } from "@radix-ui/themes";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";

export default function LoginComponent() {
  const { user, isLoading } = useAuth0Firebase();

  if (isLoading) {
    return (
      <div className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5">
        <span className="text-base text-white/50">Loading…</span>
      </div>
    );
  }

  // Logged out: jump straight in as a guest, or sign in.
  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/learning"
          className="rounded-full px-4 py-2.5 text-base font-medium text-white/70 transition-colors hover:text-white"
        >
          Guest
        </Link>
        <a
          href="/login"
          className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-base font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10"
        >
          Sign in
        </a>
      </div>
    );
  }

  // Logged in: real avatar + name with a logout dropdown.
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

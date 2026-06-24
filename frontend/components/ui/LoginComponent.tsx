"use client";

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

  // Logged out: a clean sign-in pill (no guest avatar badge).
  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-base font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10"
      >
        Sign in
      </a>
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

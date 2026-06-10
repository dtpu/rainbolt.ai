"use client";

import { Avatar, DropdownMenu } from "@radix-ui/themes";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";

export default function LoginComponent() {
    const { user, isLoading } = useAuth0Firebase();

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="text-sm text-fg-muted">Loading…</span>
            </div>
        );
    }

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <button className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-white/10">
                    <Avatar
                        size="1"
                        src={user?.picture || ""}
                        radius="full"
                        fallback={user?.name?.[0]?.toUpperCase() || "G"}
                    />
                    <span className="text-sm font-medium text-fg">
                        {user?.name ? user.name.substring(0, 10) : "Sign in"}
                    </span>
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="min-w-[200px]">
                {user ? (
                    <DropdownMenu.Item asChild>
                        <a href="/auth/logout" className="cursor-pointer text-red-500">
                            Log Out
                        </a>
                    </DropdownMenu.Item>
                ) : (
                    <DropdownMenu.Item asChild>
                        <a href="/auth/login" className="cursor-pointer">
                            Log In
                        </a>
                    </DropdownMenu.Item>
                )}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}

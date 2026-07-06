"use client";

import { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { UserIdSync } from "@/components/UserIdSync";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UserIdSync />
      <Theme>{children}</Theme>
    </>
  );
}

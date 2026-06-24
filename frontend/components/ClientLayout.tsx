"use client";

import { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { UserProvider } from "@/hooks/useUser";
import { FirebaseUserSync } from "@/components/FirebaseUserSync";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <FirebaseUserSync />
      <Theme>{children}</Theme>
    </UserProvider>
  );
}

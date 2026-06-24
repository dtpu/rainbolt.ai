import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "rainbolt.ai",
  description:
    "AI geolocation. Upload any photo and rainbolt.ai pinpoints where it was taken, powered by hundreds of thousands of geotagged images and expert GeoGuessr-style reasoning.",
  openGraph: {
    title: "rainbolt.ai",
    description:
      "AI geolocation: upload any photo and find out where on Earth it was taken.",
    siteName: "rainbolt.ai",
    images: ["/rainbolt_logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

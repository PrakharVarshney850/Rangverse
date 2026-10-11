import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { Tooltip } from "radix-ui";

import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rangverse — The Workspace Behind the Stage",
    template: "%s · Rangverse",
  },
  description:
    "Rangverse is the internal workspace for Rangmanch: interns, attendance, tasks, daily reports and business data in one place.",
  applicationName: "Rangverse",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0806",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`dark ${cinzel.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}

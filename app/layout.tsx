import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Battlepass — Gamified Todos",
  description:
    "Turn your to-do list into a game. Complete tasks, earn XP and coins, level up, and redeem rewards.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

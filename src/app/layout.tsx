import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GARGANTUA — An archive beyond time",
  description:
    "A continuous cinematic journey through space, memory, and the making of an engineer.",
  keywords: ["Uday Kumar G", "AI", "Machine Learning", "portfolio", "AURIZE", "Three.js"],
  authors: [{ name: "Uday Kumar G" }],
  openGraph: {
    title: "GARGANTUA — An archive beyond time",
    description: "An authored journey through an archive outside linear time.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Baloo_2, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sealed Pair — Sealed P2P OTC on Sui",
  description:
    "Move size without tipping your hand. Sealed peer-to-peer OTC trading on Sui, powered by Walrus, Seal, and Tatum.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="lagoon"
      style={{ ["--accent-pick" as string]: "#1f8fd1" }}
      className={`${baloo.variable} ${jakarta.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { HomeButton } from "@/components/home-button";
import { WalletProviders } from "@/components/wallet-providers";
import { version } from "../package.json";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ValueCurator · Guarded execution for tokenized assets",
  description:
    "Evidence-gated execution for autonomous finance: mandate, Pyth market evidence, Jupiter quotes and deterministic risk controls.",
  icons: {
    icon: "/proofgate-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${jetbrainsMono.variable} min-h-screen bg-stocklana-bg font-sans text-white antialiased`}
      >
        <WalletProviders>
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
            <HomeButton />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stocklana-muted">{version}</p>
          </div>
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}

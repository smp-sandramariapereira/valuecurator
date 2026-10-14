import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/institutional/site-header";
import { WalletProviders } from "@/components/wallet-providers";
import { SITE_URL } from "@/lib/institutional";
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
  metadataBase: new URL(SITE_URL),
  title: "ValueCurator | AI-Powered Financial Infrastructure",
  description:
    "ValueCurator is a research-driven Deep Tech initiative building intelligent financial infrastructure for tokenized assets, combining AI, quantitative research, verifiable authorization and Solana.",
  openGraph: {
    title: "ValueCurator | AI-Powered Financial Infrastructure",
    description:
      "Research-driven intelligence, verifiable authorization, and blockchain infrastructure for tokenized assets.",
    url: SITE_URL,
    siteName: "ValueCurator",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ValueCurator | AI-Powered Financial Infrastructure",
    description:
      "Research-driven intelligence, verifiable authorization, and blockchain infrastructure for tokenized assets.",
  },
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
          <SiteHeader />
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}

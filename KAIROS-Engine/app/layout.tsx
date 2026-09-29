import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { WalletProviders } from "@/components/wallet-providers";
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
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}

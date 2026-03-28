import type { Metadata } from "next";
import { Lato, Geist_Mono } from "next/font/google";
import "./globals.css";

const latoSans = Lato({
  variable: "--font-lato-sans",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LohikAral",
  description: "LohikAral, A learning management system",
  icons: {
    icon: "/logo.png",
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
        className={`${latoSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

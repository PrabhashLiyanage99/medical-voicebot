import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Voicebot",
  description: "Multilingual medical appointment booking assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
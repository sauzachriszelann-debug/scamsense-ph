import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScamSense PH | Think before you click.",
  description: "Spot warning signs in suspicious messages with ScamSense PH, a free and private scam awareness checker.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

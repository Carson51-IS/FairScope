import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FairScope — Federal Fair Use Analysis",
  description:
    "A structured federal fair-use research engine that retrieves and applies § 107 case law to user-described facts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-navy-50 text-navy-900 min-h-screen">{children}</body>
    </html>
  );
}

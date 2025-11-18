import type { Metadata } from "next";
import "./globals.css";
import { VisitorProvider } from "@/context/org.context";

export const metadata: Metadata = {
  title: "Chat Bot",
  description: "Created by Anup Maharjan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <VisitorProvider>{children}</VisitorProvider>
      </body>
    </html>
  );
}

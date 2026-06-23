import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hendrix Mechanical Analytics",
  description: "Stress-strain analysis and research-ready outputs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

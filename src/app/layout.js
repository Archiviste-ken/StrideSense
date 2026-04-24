import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import NavigationAnnouncer from "../components/NavigationAnnouncer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "StrideSense – Smart Assistive System",
  description:
    "StrideSense is a prototype assistive interface designed for visually impaired users.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950 text-white">
        <AppShell>
          <NavigationAnnouncer />
          {children}
        </AppShell>
      </body>
    </html>
  );
}

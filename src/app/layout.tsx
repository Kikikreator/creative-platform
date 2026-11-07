import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ActivityTracker from "@/components/analytics/activity-tracker";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kiki Creator Class | Kelas Kreatif Online",
  description: "Kelas kreatif online dengan materi terstruktur, mentor berpengalaman, dan ruang belajar yang fleksibel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConfirmDialogProvider>
          <ActivityTracker />
          {children}
        </ConfirmDialogProvider>
      </body>
    </html>
  );
}

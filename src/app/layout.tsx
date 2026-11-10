import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import ActivityTracker from "@/components/analytics/activity-tracker";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog-provider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
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
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
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

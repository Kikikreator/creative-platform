import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import ActivityTracker from "@/components/analytics/activity-tracker";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog-provider";
import PwaRegister from "@/components/pwa/pwa-register";

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
  description:
    "Kelas kreatif online dengan materi terstruktur, mentor berpengalaman, dan ruang belajar yang fleksibel.",
  manifest: "/manifest.webmanifest",
  applicationName: "Kiki Creator Class",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kiki Creator",
  },
  icons: {
    icon: [
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/pwa-192x192.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#260047",
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
          <PwaRegister />
          {children}
        </ConfirmDialogProvider>
      </body>
    </html>
  );
}

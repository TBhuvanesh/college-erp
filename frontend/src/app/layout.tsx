import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { SimulationProvider } from "@/context/SimulationContext";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sreyas College ERP - Academic Portal",
  description: "Next-generation College ERP Platform (Admin, Faculty, and Student Portals)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 antialiased flex flex-col font-sans">
        <SimulationProvider>
          <AuthProvider>{children}</AuthProvider>
        </SimulationProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GreenTop — AI Rooftop Transformation for Atlanta",
  description:
    "GreenTop gives any Atlanta building owner an instant, AI-generated plan for their roof — solar, green roof, cool roof, rainwater, or beekeeping — ranked by cost, feasibility, and impact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-greentop-bg text-greentop-text">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

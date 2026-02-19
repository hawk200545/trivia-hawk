import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Trivia Hawk — Real-Time Multiplayer Quiz",
  description:
    "Host and play trivia quizzes in real-time with friends. Create custom quizzes, join with room codes, compete on live leaderboards!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="bg-grid" />
        {children}
      </body>
    </html>
  );
}

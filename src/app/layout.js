// app/layout.js
"use client";

import { Geist, Geist_Mono } from "next/font/google";
import Provider from "@/providers/SessionProvider";
import "./globals.css";
import Navbar from "./components/Navbar";
import { usePathname } from "next/navigation";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Provider>
          {/* Hide navbar on dashboard */}
          {!isDashboard && <Navbar />}

          <main>{children}</main>
        </Provider>
      </body>
    </html>
  );
}

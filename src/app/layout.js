// app/layout.js
"use client";

import { Geist, Geist_Mono } from "next/font/google";
import Provider from "@/providers/SessionProvider";
import "./globals.css";

import { usePathname } from "next/navigation";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// meta data


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
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937', // dark gray
              color: '#fff',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            },
          }}
        />
          {!isDashboard && <Footer />}
        </Provider>
      </body>
    </html>
  );
}

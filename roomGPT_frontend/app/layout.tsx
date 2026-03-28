// import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";
import "../styles/globals.css";
import { ToastProvider } from "../components/Toast";

let title = "Lumière - AI 智能家装规划师";
let description = "上传房间照片，几秒钟内即可生成多种装修效果图。";
let ogimage = "https://roomgpt-demo.vercel.app/og-image.png";
let sitename = "Lumière AI";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("http://localhost:3000"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    images: [],
    title,
    description,
    url: "localhost",
    siteName: sitename,
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogimage],
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-primary text-text-primary">
        <ToastProvider>
          {children}
        </ToastProvider>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}

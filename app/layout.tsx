import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARM-01 Control Station",
  description: "Arduino Uno 로봇팔을 키보드와 Web Serial로 제어합니다.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

import type { Metadata } from "next"
import "@/styles/globals.css"
import { ThemeProvider } from "@/context/ThemeProvider"

export const metadata: Metadata = {
  title: "Foliate Reader",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

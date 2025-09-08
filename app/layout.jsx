import "./globals.css"

export const metadata = {
  title: "Transit Departures",
  description: "Real-time bus departure information",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="antialiased">
      <body className="font-sans">{children}</body>
    </html>
  )
}

import './globals.css'
import React from 'react'
import Nav from '../components/Nav'

export const metadata = {
  title: 'Portfolio Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}

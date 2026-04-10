'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
})

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html className="dark" lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}

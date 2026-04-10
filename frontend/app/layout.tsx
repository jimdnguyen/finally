'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePriceStream } from '@/hooks/usePriceStream'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
})

function RootLayoutContent({ children }: { children: ReactNode }) {
  usePriceStream()  // Initialize hook at root
  return children
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html className="dark" lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <RootLayoutContent>{children}</RootLayoutContent>
        </QueryClientProvider>
      </body>
    </html>
  )
}


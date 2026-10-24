import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter } from 'react-router'
import { createQueryClient } from './api/queryClient'
import ErrorBoundary from './app/ErrorBoundary'
import AppRoutes from './app/AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import ToastRegion from './common/Toast'

export default function App() {
  const [client] = useState(createQueryClient)
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <ToastRegion />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

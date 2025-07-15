import type { Metadata } from 'next';
import NavBar from '@/components/NavBar';
import ClientWrapper from '@/components/ClientWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAG Admin',
  description: 'Admin panel for multi-tenant RAG application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
          <ClientWrapper>
            <QueryProvider>
              <AuthProvider>
                <NavBar />
                {children}
              </AuthProvider>
            </QueryProvider>
          </ClientWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
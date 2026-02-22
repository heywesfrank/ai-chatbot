import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

// Load the standard Inter font
const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Knowledge Base Bot',
  description: 'Minimalist RAG Chatbot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}

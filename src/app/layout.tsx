import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';

import AppProvider from '../contexts/AppProvider';

import '@stream-io/video-react-sdk/dist/css/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Google Meet Clone',
  description:
    'Video meetings with live captions, shared whiteboards, and secure host admission.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
        <html lang="en">
          <body><AppProvider>{children}</AppProvider></body>
        </html>
    </ClerkProvider>
  );
}

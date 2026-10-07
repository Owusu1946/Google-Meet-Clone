import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';

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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from 'next'; import './globals.css';
export const metadata: Metadata = { title: 'EventFlow', description: 'Không gian vận hành sự kiện EventFlow' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }

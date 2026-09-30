import { AppShell } from '../../components/app-shell';
import { AuthenticatedApp } from '../../components/authenticated-app';
import { DataRefreshProvider } from '../../components/data-refresh-provider';
import { NotificationProvider } from '../../components/notifications/notification-provider';

export default function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthenticatedApp><DataRefreshProvider><NotificationProvider><AppShell>{children}</AppShell></NotificationProvider></DataRefreshProvider></AuthenticatedApp>;
}

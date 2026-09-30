import type { AuthUser } from '@eventflow/contracts';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/events',
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../lib/api-client', () => ({
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('./notifications/notification-bell', () => ({
  NotificationBell: () => <button type="button" aria-label="Thông báo">🔔</button>,
}));

import { AppShell } from './app-shell';
import { AuthenticatedApp } from './authenticated-app';
import { getCurrentUser } from '../lib/api-client';

const user: AuthUser = { id: 'user-1', email: 'member@example.com', displayName: 'Ngọc An', systemRole: 'USER', status: 'ACTIVE', mustChangePassword: false, permissions: [] };

describe('AppShell', () => {
  it('keeps desktop sidebar and mobile bottom navigation mutually hidden by breakpoint classes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    const { container } = render(<AuthenticatedApp><AppShell><p>Nội dung</p></AppShell></AuthenticatedApp>);
    await screen.findByText('Nội dung');
    const sidebar = container.querySelector('aside');
    const mobileNavigation = screen.getByLabelText('Điều hướng di động');
    expect(sidebar?.className).toContain('hidden');
    expect(sidebar?.className).toContain('lg:flex');
    expect(mobileNavigation.className).toContain('lg:hidden');
    expect(screen.getByRole('link', { name: 'Sự kiện' }).getAttribute('href')).toBe('/app/events');
  });
});

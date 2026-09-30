import { Injectable } from '@nestjs/common';

export interface RegisteredSocket {
  id: string;
  emit(event: string, payload: { version: 1; reason: 'SESSION_REVOKED' }): boolean;
  disconnect(close?: boolean): void;
}

interface SocketRegistration {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

type RealtimeDisconnectTarget = { kind: 'session' | 'user'; id: string; reason: 'SESSION_REVOKED' };
type RealtimeDisconnecter = (target: RealtimeDisconnectTarget) => void;
const MAX_TIMER_DELAY_MS = 2_147_000_000;

/**
 * Process-local socket registry. The Socket.IO Redis adapter carries room
 * broadcasts between instances, while this registry handles immediate local
 * disconnects after a session or account is revoked.
 */
@Injectable()
export class SocketSessionRegistry {
  private readonly registrations = new Map<string, SocketRegistration>();
  private readonly socketIdsBySession = new Map<string, Set<string>>();
  private readonly socketIdsByUser = new Map<string, Set<string>>();
  private readonly sockets = new Map<string, RegisteredSocket>();
  private readonly sessionExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private remoteDisconnecter: RealtimeDisconnecter | null = null;

  register(socket: RegisteredSocket, userId: string, sessionId: string, expiresAt: Date): void {
    this.unregister(socket.id);
    this.registrations.set(socket.id, { userId, sessionId, expiresAt });
    this.sockets.set(socket.id, socket);
    this.add(this.socketIdsBySession, sessionId, socket.id);
    this.add(this.socketIdsByUser, userId, socket.id);
    this.scheduleSessionExpiry(sessionId, expiresAt);
  }

  setRemoteDisconnecter(disconnecter: RealtimeDisconnecter): void {
    this.remoteDisconnecter = disconnecter;
  }

  unregister(socketId: string): void {
    const registration = this.registrations.get(socketId);
    if (!registration) return;
    this.registrations.delete(socketId);
    this.sockets.delete(socketId);
    this.remove(this.socketIdsBySession, registration.sessionId, socketId);
    this.remove(this.socketIdsByUser, registration.userId, socketId);
    if (!this.socketIdsBySession.has(registration.sessionId)) this.clearSessionExpiry(registration.sessionId);
  }

  disconnectSession(sessionId: string, reason: 'SESSION_REVOKED' = 'SESSION_REVOKED'): void {
    this.disconnectSocketIds(this.socketIdsBySession.get(sessionId), reason);
    this.remoteDisconnecter?.({ kind: 'session', id: sessionId, reason });
  }

  disconnectUser(userId: string, reason: 'SESSION_REVOKED' = 'SESSION_REVOKED'): void {
    this.disconnectSocketIds(this.socketIdsByUser.get(userId), reason);
    this.remoteDisconnecter?.({ kind: 'user', id: userId, reason });
  }

  connectionCount(): number {
    return this.sockets.size;
  }

  private disconnectSocketIds(socketIds: Set<string> | undefined, reason: 'SESSION_REVOKED'): void {
    if (!socketIds) return;
    for (const socketId of [...socketIds]) {
      const socket = this.sockets.get(socketId);
      if (socket) {
        socket.emit('session.revoked', { version: 1, reason });
        socket.disconnect(true);
      }
      this.unregister(socketId);
    }
  }

  private scheduleSessionExpiry(sessionId: string, expiresAt: Date): void {
    this.clearSessionExpiry(sessionId);
    const remainingMs = expiresAt.getTime() - Date.now();
    const delayMs = Math.min(Math.max(remainingMs, 0), MAX_TIMER_DELAY_MS);
    const timer = setTimeout(() => {
      if (Date.now() >= expiresAt.getTime()) {
        this.disconnectSession(sessionId);
        return;
      }
      this.scheduleSessionExpiry(sessionId, expiresAt);
    }, delayMs);
    timer.unref();
    this.sessionExpiryTimers.set(sessionId, timer);
  }

  private clearSessionExpiry(sessionId: string): void {
    const timer = this.sessionExpiryTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.sessionExpiryTimers.delete(sessionId);
  }

  private add(index: Map<string, Set<string>>, key: string, socketId: string): void {
    const values = index.get(key) ?? new Set<string>();
    values.add(socketId);
    index.set(key, values);
  }

  private remove(index: Map<string, Set<string>>, key: string, socketId: string): void {
    const values = index.get(key);
    if (!values) return;
    values.delete(socketId);
    if (values.size === 0) index.delete(key);
  }
}

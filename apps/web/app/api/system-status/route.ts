import { NextResponse } from 'next/server'; import type { ReadinessFailureResponse, ReadinessResponse } from '@eventflow/contracts';
const apiBaseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
export async function GET(): Promise<NextResponse<ReadinessResponse | ReadinessFailureResponse | { status: 'error'; message: string }>> {
  try { const response = await fetch(`${apiBaseUrl}/api/v1/health/ready`, { cache: 'no-store' }); const data: unknown = await response.json(); if (isReadinessResponse(data)) return NextResponse.json(data, { status: response.status }); return NextResponse.json({ status: 'error', message: 'Unexpected API response.' }, { status: 502 }); }
  catch { return NextResponse.json({ status: 'error', message: 'The API is unreachable.' }, { status: 503 }); }
}
function isReadinessResponse(value: unknown): value is ReadinessResponse | ReadinessFailureResponse { return typeof value === 'object' && value !== null && 'status' in value && 'service' in value && 'timestamp' in value && 'dependencies' in value; }

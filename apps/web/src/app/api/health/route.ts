/**
 * Purpose: Lightweight Next.js health endpoint for container and reverse-proxy checks.
 * Caller: Docker health checks, Nginx upstream checks, and deployment smoke tests.
 * Deps: NextResponse.
 * MainFuncs: Returns a minimal frontend process health response.
 * SideEffects: None.
 */
import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    status: 'ok',
    service: 'jimpitan-web',
    timestamp: new Date().toISOString(),
  });
}

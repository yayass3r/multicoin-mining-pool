import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'multicoin-mining-pool',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    message: 'Mining pool is running 24/7!'
  });
}

// HEAD request for health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

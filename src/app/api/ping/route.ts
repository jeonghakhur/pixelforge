import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }
  return NextResponse.json({ ok: true }, { headers: CORS });
}

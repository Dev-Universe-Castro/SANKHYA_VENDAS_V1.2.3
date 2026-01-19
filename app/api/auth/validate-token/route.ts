import { NextResponse } from 'next/server';
import { obterToken } from '@/lib/sankhya-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contrato } = body;

    const token = await obterToken(true, contrato);
    if (token) {
      return NextResponse.json({ 
        success: true, 
        token: token,
        expiry: new Date(Date.now() + (20 * 60 * 1000)).toISOString()
      });
    } else {
      return NextResponse.json({ success: false, error: 'Token não gerado' }, { status: 401 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

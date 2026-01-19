
import { NextResponse } from 'next/server';
import { oracleAuthService } from '@/lib/oracle-auth-service';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    await oracleAuthService.updateUserStatus(id, 'bloqueado');

    return NextResponse.json({ 
      success: true,
      message: 'Usuário bloqueado com sucesso' 
    });
  } catch (error: any) {
    console.error('❌ Erro ao bloquear usuário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao bloquear usuário' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

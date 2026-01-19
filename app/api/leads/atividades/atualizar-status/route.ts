
import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { CODATIVIDADE, STATUS } = body;

    if (!CODATIVIDADE || !STATUS) {
      return NextResponse.json(
        { error: 'CODATIVIDADE e STATUS são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔄 Atualizando status da atividade:', { CODATIVIDADE, STATUS });

    const sql = `
      UPDATE AD_ADLEADSATIVIDADES
      SET STATUS = :status
      WHERE CODATIVIDADE = :codAtividade
    `;

    await oracleService.executeQuery(sql, {
      status: STATUS,
      codAtividade: CODATIVIDADE
    });

    console.log('✅ Status da atividade atualizado com sucesso');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar status:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar status' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;


import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const { codLead, codParc } = await request.json();

    if (!codLead || !codParc) {
      return NextResponse.json(
        { error: 'codLead e codParc são obrigatórios' },
        { status: 400 }
      );
    }

    const idEmpresa = 1;

    console.log('🔄 Atualizando parceiro do lead:', { codLead, codParc });

    const sql = `
      UPDATE AD_LEADS
      SET CODPARC = :codParc,
          DATA_ATUALIZACAO = SYSDATE
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sql, {
      codParc,
      codLead,
      idEmpresa
    });

    console.log('✅ Parceiro do lead atualizado');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar parceiro do lead:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar parceiro do lead' },
      { status: 500 }
    );
  }
}

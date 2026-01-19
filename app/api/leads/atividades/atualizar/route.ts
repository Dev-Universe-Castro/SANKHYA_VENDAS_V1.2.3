import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { CODATIVIDADE, TITULO, DESCRICAO, TIPO, COR, DATA_INICIO, DATA_FIM, ATIVO } = body;

    if (!CODATIVIDADE) {
      return NextResponse.json(
        { error: 'CODATIVIDADE é obrigatório' },
        { status: 400 }
      );
    }

    console.log('🔄 Atualizando atividade:', { CODATIVIDADE, TITULO, DESCRICAO, TIPO, COR, DATA_INICIO, DATA_FIM, ATIVO });

    const updates: string[] = [];
    const params: any = { codAtividade: CODATIVIDADE };
    let paramIndex = 1;

    // Construir a query de atualização dinamicamente
    if (TITULO !== undefined) {
      updates.push(`TITULO = :param${paramIndex}`);
      params[`param${paramIndex}`] = TITULO;
      paramIndex++;
    }

    if (DESCRICAO !== undefined) {
      updates.push(`DESCRICAO = :param${paramIndex}`);
      params[`param${paramIndex}`] = DESCRICAO;
      paramIndex++;
    }

    if (TIPO !== undefined) {
      updates.push(`TIPO = :param${paramIndex}`);
      params[`param${paramIndex}`] = TIPO;
      paramIndex++;
    }

    if (COR !== undefined) {
      updates.push(`COR = :param${paramIndex}`);
      params[`param${paramIndex}`] = COR;
      paramIndex++;
    }

    if (DATA_INICIO) {
      // Formatar data para Oracle DD/MM/YYYY HH24:MI:SS
      const date = new Date(DATA_INICIO);
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const hora = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const seg = String(date.getSeconds()).padStart(2, '0');
      const dataFormatada = `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;

      updates.push(`DATA_INICIO = TO_TIMESTAMP(:param${paramIndex}, 'DD/MM/YYYY HH24:MI:SS')`);
      params[`param${paramIndex}`] = dataFormatada;
      paramIndex++;
    }

    if (DATA_FIM) {
      // Formatar data para Oracle DD/MM/YYYY HH24:MI:SS
      const date = new Date(DATA_FIM);
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const hora = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const seg = String(date.getSeconds()).padStart(2, '0');
      const dataFormatada = `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;

      updates.push(`DATA_FIM = TO_TIMESTAMP(:param${paramIndex}, 'DD/MM/YYYY HH24:MI:SS')`);
      params[`param${paramIndex}`] = dataFormatada;
      paramIndex++;
    }

    if (ATIVO !== undefined) {
      updates.push(`ATIVO = :param${paramIndex}`);
      params[`param${paramIndex}`] = ATIVO;
      paramIndex++;
      console.log('✏️ Atualizando ATIVO para:', ATIVO);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    const sql = `
      UPDATE AD_ADLEADSATIVIDADES
      SET ${updates.join(', ')}
      WHERE CODATIVIDADE = :codAtividade
    `;

    console.log('📝 SQL:', sql);
    console.log('📝 Params:', params);

    await oracleService.executeQuery(sql, params);

    console.log('✅ Atividade atualizada com sucesso');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar atividade:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar atividade' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
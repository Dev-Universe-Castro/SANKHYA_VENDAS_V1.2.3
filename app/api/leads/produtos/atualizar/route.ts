import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('📥 Dados recebidos na API atualizar:', body);

    const { codItem, codLead, quantidade, vlrunit } = body;

    if (!codItem || !quantidade || !vlrunit) {
      console.error('❌ Dados obrigatórios faltando:', { codItem, quantidade, vlrunit });
      return NextResponse.json(
        { error: 'codItem, quantidade e vlrunit são obrigatórios' },
        { status: 400 }
      );
    }

    if (!codLead) {
      console.error('❌ codLead é obrigatório para recalcular o total');
      return NextResponse.json(
        { error: 'codLead é obrigatório' },
        { status: 400 }
      );
    }

    const idEmpresa = 1; // ID_EMPRESA fixo
    const vlrtotal = Number(quantidade) * Number(vlrunit);
    console.log('💰 Calculando total do produto:', { quantidade, vlrunit, vlrtotal });

    // 1. Atualizar o produto
    const sqlProduto = `
      UPDATE AD_ADLEADSPRODUTOS
      SET QUANTIDADE = :quantidade,
          VLRUNIT = :vlrunit,
          VLRTOTAL = :vlrtotal
      WHERE CODITEM = :codItem
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sqlProduto, {
      quantidade,
      vlrunit,
      vlrtotal,
      codItem,
      idEmpresa
    });

    console.log('✅ Produto atualizado');

    // 2. Recalcular o valor total do lead
    const totalResult = await oracleService.executeOne<{ TOTAL: number }>(
      `SELECT NVL(SUM(VLRTOTAL), 0) AS TOTAL 
       FROM AD_ADLEADSPRODUTOS 
       WHERE CODLEAD = :codLead 
         AND ID_EMPRESA = :idEmpresa 
         AND ATIVO = 'S'`,
      { codLead, idEmpresa }
    );

    const novoValorTotal = totalResult?.TOTAL || 0;
    console.log('💰 Novo valor total calculado:', novoValorTotal);

    // 3. Atualizar o valor total do lead
    const sqlLead = `
      UPDATE AD_LEADS
      SET VALOR = :valor,
          DATA_ATUALIZACAO = SYSDATE
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sqlLead, {
      valor: novoValorTotal,
      codLead,
      idEmpresa
    });

    console.log('✅ Lead atualizado com novo valor total');

    return NextResponse.json({ 
      success: true,
      novoValorTotal: novoValorTotal
    });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar produto:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}
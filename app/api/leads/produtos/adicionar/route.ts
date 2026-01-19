import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const produtoData = await request.json();
    const idEmpresa = 1; // ID_EMPRESA fixo

    console.log('➕ [API] Adicionando produto ao lead:', produtoData);

    // Validações
    if (!produtoData.CODLEAD) {
      return NextResponse.json(
        { error: 'CODLEAD é obrigatório' },
        { status: 400 }
      );
    }

    if (!produtoData.CODPROD) {
      return NextResponse.json(
        { error: 'CODPROD é obrigatório' },
        { status: 400 }
      );
    }

    if (!produtoData.QUANTIDADE || produtoData.QUANTIDADE <= 0) {
      return NextResponse.json(
        { error: 'QUANTIDADE deve ser maior que zero' },
        { status: 400 }
      );
    }

    // 1. Inserir produto em AD_ADLEADSPRODUTOS
    const sqlInserir = `
      INSERT INTO AD_ADLEADSPRODUTOS (
        CODLEAD, ID_EMPRESA, CODPROD, DESCRPROD, QUANTIDADE, VLRUNIT, VLRTOTAL, ATIVO
      ) VALUES (
        :codLead, :idEmpresa, :codProd, :descrProd, :quantidade, :vlrUnit, :vlrTotal, 'S'
      )
    `;

    await oracleService.executeQuery(sqlInserir, {
      codLead: produtoData.CODLEAD,
      idEmpresa,
      codProd: produtoData.CODPROD,
      descrProd: produtoData.DESCRPROD || 'Produto sem descrição',
      quantidade: produtoData.QUANTIDADE,
      vlrUnit: produtoData.VLRUNIT || 0,
      vlrTotal: produtoData.VLRTOTAL || (produtoData.QUANTIDADE * (produtoData.VLRUNIT || 0))
    });

    console.log('✅ [API] Produto inserido em AD_ADLEADSPRODUTOS');

    // 2. Recalcular valor total do lead
    const totalResult = await oracleService.executeOne<{ TOTAL: number }>(
      `SELECT NVL(SUM(VLRTOTAL), 0) AS TOTAL 
       FROM AD_ADLEADSPRODUTOS 
       WHERE CODLEAD = :codLead 
         AND ID_EMPRESA = :idEmpresa 
         AND ATIVO = 'S'`,
      { codLead: produtoData.CODLEAD, idEmpresa }
    );

    const novoValorTotal = totalResult?.TOTAL || 0;
    console.log('💰 [API] Novo valor total calculado:', novoValorTotal);

    // 3. Atualizar valor total em AD_LEADS
    const sqlAtualizarLead = `
      UPDATE AD_LEADS
      SET VALOR = :valor,
          DATA_ATUALIZACAO = SYSDATE
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sqlAtualizarLead, {
      valor: novoValorTotal,
      codLead: produtoData.CODLEAD,
      idEmpresa
    });

    console.log('✅ [API] Valor total do lead atualizado em AD_LEADS');

    // 4. Buscar o produto recém-criado
    const produtoCriado = await oracleService.executeOne<any>(
      `SELECT 
        CODITEM,
        CODLEAD,
        ID_EMPRESA,
        CODPROD,
        DESCRPROD,
        QUANTIDADE,
        VLRUNIT,
        VLRTOTAL,
        ATIVO,
        TO_CHAR(DATA_INCLUSAO, 'DD/MM/YYYY') AS DATA_INCLUSAO
      FROM AD_ADLEADSPRODUTOS 
      WHERE CODLEAD = :codLead 
        AND ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
      ORDER BY CODITEM DESC 
      FETCH FIRST 1 ROWS ONLY`,
      { codLead: produtoData.CODLEAD, idEmpresa }
    );

    return NextResponse.json({ 
      success: true,
      produto: produtoCriado,
      novoValorTotal 
    });
  } catch (error: any) {
    console.error('❌ [API] Erro ao adicionar produto:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao adicionar produto ao lead' },
      { status: 500 }
    );
  }
}
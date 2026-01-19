
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { oracleService } from '@/lib/oracle-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json({ produtos: [] });
    }

    // Obter usuário
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA;

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    console.log(`🔍 Buscando produtos no Oracle: "${query}"`);

    const sql = `
      SELECT 
        CODPROD,
        DESCRPROD,
        ATIVO
      FROM AS_PRODUTOS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
        AND (UPPER(DESCRPROD) LIKE :query OR CODPROD LIKE :queryExact)
      ORDER BY DESCRPROD
      FETCH FIRST :limit ROWS ONLY
    `;

    const produtos = await oracleService.executeQuery(sql, {
      idEmpresa,
      query: `%${query.toUpperCase()}%`,
      queryExact: `${query}%`,
      limit
    });

    console.log(`✅ ${produtos.length} produtos encontrados`);

    return NextResponse.json({ produtos });

  } catch (error: any) {
    console.error('❌ Erro ao buscar produtos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

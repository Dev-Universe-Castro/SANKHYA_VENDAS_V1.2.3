import { NextResponse } from 'next/server';
import { atualizarEstagioLead, consultarLeads } from '@/lib/oracle-leads-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { codLeed, novoEstagio } = await request.json();

    // Buscar ID_EMPRESA do usuário autenticado a partir do cookie
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      console.error('❌ Cookie de usuário não encontrado');
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    let currentUser;
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie.value));
    } catch (error) {
      console.error('❌ Erro ao fazer parse do cookie:', error);
      return NextResponse.json(
        { error: 'Cookie de autenticação inválido' },
        { status: 401 }
      );
    }

    const idEmpresa = currentUser.ID_EMPRESA || currentUser.idEmpresa;

    console.log('🔄 API - Recebendo requisição:', { codLeed, novoEstagio, tipo: typeof codLeed, idEmpresa });

    if (!codLeed || !novoEstagio) {
      console.error('❌ Parâmetros faltando:', { codLeed, novoEstagio });
      return NextResponse.json(
        { error: 'CODLEAD e novoEstagio são obrigatórios' },
        { status: 400 }
      );
    }

    // Normalizar codLeed para string
    const codLeedStr = String(codLeed);

    console.log('🔍 Buscando lead diretamente no banco...');

    // Buscar o lead DIRETAMENTE no banco SEM filtros de acesso
    const { oracleService } = await import('@/lib/oracle-db');
    const leadDireto = await oracleService.executeOne(
      `SELECT 
        TO_CHAR(CODLEAD) AS CODLEAD,
        TO_CHAR(CODESTAGIO) AS CODESTAGIO,
        STATUS_LEAD,
        ATIVO,
        ID_EMPRESA,
        NOME
      FROM AD_LEADS 
      WHERE CODLEAD = :codLeed`,
      { codLeed: codLeedStr }
    );

    console.log('📋 Lead encontrado no banco:', leadDireto);

    if (!leadDireto) {
      console.error('❌ Lead não existe no banco de dados:', { codLeedBuscado: codLeedStr });

      // Buscar todos os leads para comparação
      const todosLeads = await oracleService.executeQuery(
        `SELECT TO_CHAR(CODLEAD) AS CODLEAD, NOME, ATIVO, ID_EMPRESA FROM AD_LEADS ORDER BY CODLEAD DESC FETCH FIRST 10 ROWS ONLY`,
        {}
      );
      console.log('📊 Últimos 10 leads no banco:', todosLeads);

      return NextResponse.json(
        { error: 'Lead não encontrado no banco de dados' },
        { status: 404 }
      );
    }

    // Verificar se o lead pertence à empresa
    if (leadDireto.ID_EMPRESA !== idEmpresa) {
      console.error('❌ Lead pertence a outra empresa:', { 
        leadEmpresa: leadDireto.ID_EMPRESA, 
        empresaEsperada: idEmpresa 
      });
      return NextResponse.json(
        { error: 'Lead não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se está ativo
    if (leadDireto.ATIVO !== 'S') {
      console.error('❌ Lead está inativo:', { ATIVO: leadDireto.ATIVO });
      return NextResponse.json(
        { error: 'Lead está inativo' },
        { status: 400 }
      );
    }

    console.log('📋 Lead atual:', { 
      CODLEAD: leadDireto.CODLEAD, 
      NOME: leadDireto.NOME,
      CODESTAGIO: leadDireto.CODESTAGIO, 
      STATUS_LEAD: leadDireto.STATUS_LEAD 
    });

    // Bloquear alteração se o lead estiver ganho ou perdido
    if (leadDireto.STATUS_LEAD === 'GANHO' || leadDireto.STATUS_LEAD === 'PERDIDO') {
      console.warn('⚠️ Tentativa de alterar lead finalizado:', { STATUS_LEAD: leadDireto.STATUS_LEAD });
      return NextResponse.json(
        { error: 'Não é possível alterar o estágio de leads ganhos ou perdidos' },
        { status: 403 }
      );
    }

    const resultado = await atualizarEstagioLead(codLeedStr, String(novoEstagio), idEmpresa);

    console.log('✅ Estágio atualizado com sucesso:', { 
      CODLEAD: resultado?.CODLEAD,
      CODESTAGIO_ANTIGO: leadDireto.CODESTAGIO,
      CODESTAGIO_NOVO: resultado?.CODESTAGIO
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('❌ API Route - Erro ao atualizar estágio:', error.message);

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar estágio' },
      { status: 500 }
    );
  }
}
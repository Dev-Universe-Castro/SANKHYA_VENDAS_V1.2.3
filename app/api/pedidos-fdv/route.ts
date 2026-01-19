
import { NextRequest, NextResponse } from 'next/server';
import { pedidosFDVService } from '@/lib/pedidos-fdv-service';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      console.error('❌ Usuário não autenticado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(decodeURIComponent(userCookie.value));
    const idEmpresa = user.ID_EMPRESA;

    console.log('📊 Buscando pedidos FDV para empresa:', idEmpresa);

    if (!idEmpresa) {
      console.error('❌ Empresa não identificada');
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const origem = searchParams.get('origem');
    const status = searchParams.get('status');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const parceiro = searchParams.get('parceiro');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log('🔍 Filtros aplicados:', { origem, status, dataInicio, dataFim, parceiro, page, limit });

    const pedidos = await pedidosFDVService.listarPedidosFDV(idEmpresa, {
      origem: (origem === 'TODOS' ? undefined : origem) as any,
      status: (status === 'TODOS' ? undefined : status) as any,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      parceiro: parceiro || undefined
    });

    // Paginação manual por enquanto, já que o service retorna tudo
    const total = pedidos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPedidos = pedidos.slice(startIndex, endIndex);

    console.log(`✅ ${paginatedPedidos.length} pedidos FDV encontrados (Total: ${total})`);

    // Serializar dados para JSON limpo usando JSON.parse/stringify para remover referências circulares
    const pedidosSerializados = JSON.parse(JSON.stringify(paginatedPedidos.map(p => ({
      ID: Number(p.ID) || 0,
      ID_EMPRESA: Number(p.ID_EMPRESA) || 0,
      ORIGEM: String(p.ORIGEM || ''),
      CODLEAD: p.CODLEAD ? Number(p.CODLEAD) : null,
      CORPO_JSON: p.CORPO_JSON || null,
      STATUS: String(p.STATUS || ''),
      NUNOTA: p.NUNOTA ? Number(p.NUNOTA) : null,
      ERRO: p.ERRO ? String(p.ERRO) : null,
      TENTATIVAS: Number(p.TENTATIVAS) || 0,
      CODUSUARIO: Number(p.CODUSUARIO) || 0,
      NOME_USUARIO: String(p.NOME_USUARIO || ''),
      DATA_CRIACAO: p.DATA_CRIACAO ? new Date(p.DATA_CRIACAO).toISOString() : null,
      DATA_ULTIMA_TENTATIVA: p.DATA_ULTIMA_TENTATIVA ? new Date(p.DATA_ULTIMA_TENTATIVA).toISOString() : null
    }))));

    return new Response(JSON.stringify({
      data: pedidosSerializados,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar pedidos FDV:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(decodeURIComponent(userCookie.value));
    const body = await request.json();

    const idPedido = await pedidosFDVService.registrarPedido({
      ID_EMPRESA: user.ID_EMPRESA,
      ORIGEM: body.origem,
      CODLEAD: body.codLead,
      CORPO_JSON: body.corpoJson,
      STATUS: body.status,
      NUNOTA: body.nunota,
      ERRO: body.erro,
      TENTATIVAS: body.tentativas || 1,
      CODUSUARIO: user.id,
      NOME_USUARIO: user.name
    });

    return NextResponse.json({ success: true, id: idPedido });
  } catch (error: any) {
    console.error('❌ Erro ao registrar pedido FDV:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar pedido', details: error.message },
      { status: 500 }
    );
  }
}

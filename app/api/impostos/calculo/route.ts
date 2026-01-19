import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { impostosCalculoService } from '@/lib/impostos-calculo-service';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    const user = JSON.parse(decodeURIComponent(userCookie.value));
    const idEmpresa = user.ID_EMPRESA;

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    const body = await request.json();

    console.log('📊 [API] Recebido pedido de cálculo de impostos');
    console.log('📋 Payload:', JSON.stringify(body, null, 2));

    if (!body.notaModelo) {
      return NextResponse.json({ error: 'Modelo da nota é obrigatório' }, { status: 400 });
    }

    if (!body.codigoCliente) {
      return NextResponse.json({ error: 'Código do cliente é obrigatório' }, { status: 400 });
    }

    if (!body.produtos || !Array.isArray(body.produtos) || body.produtos.length === 0) {
      return NextResponse.json({ error: 'Produtos são obrigatórios' }, { status: 400 });
    }

    const resultado = await impostosCalculoService.calcularImpostos(idEmpresa, body);

    if (resultado.success) {
      return NextResponse.json({
        success: true,
        produtos: resultado.produtos,
        totais: resultado.totais
      });
    } else {
      return NextResponse.json({
        success: false,
        error: resultado.error
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Erro na rota de cálculo de impostos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

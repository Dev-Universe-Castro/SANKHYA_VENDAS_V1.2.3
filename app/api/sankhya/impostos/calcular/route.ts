
import { NextResponse } from 'next/server';
import { sankhyaDynamicAPI } from '@/lib/sankhya-dynamic-api';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log('📊 Recebendo requisição para calcular impostos:', body);

    // Validações básicas
    if (!body.produtos || !Array.isArray(body.produtos) || body.produtos.length === 0) {
      return NextResponse.json(
        { error: 'Lista de produtos é obrigatória' },
        { status: 400 }
      );
    }

    if (!body.codigoCliente) {
      return NextResponse.json(
        { error: 'Código do cliente é obrigatório' },
        { status: 400 }
      );
    }

    if (!body.codigoEmpresa) {
      return NextResponse.json(
        { error: 'Código da empresa é obrigatório' },
        { status: 400 }
      );
    }

    if (!body.codigoTipoOperacao) {
      return NextResponse.json(
        { error: 'Código do tipo de operação é obrigatório' },
        { status: 400 }
      );
    }

    // Montar payload para a API Sankhya
    const payload = {
      produtos: body.produtos.map((p: any) => ({
        codigoProduto: Number(p.codigoProduto),
        quantidade: Number(p.quantidade),
        valorUnitario: Number(p.valorUnitario),
        valorDesconto: Number(p.valorDesconto || 0),
        unidade: p.unidade || 'UN'
      })),
      notaModelo: Number(body.notaModelo),
      codigoCliente: Number(body.codigoCliente),
      codigoEmpresa: Number(body.codigoEmpresa),
      codigoTipoOperacao: Number(body.codigoTipoOperacao)
    };

    console.log('📤 Enviando para API Sankhya:', payload);

    // Usar sankhyaDynamicAPI que busca as credenciais corretas da empresa
    const response = await sankhyaDynamicAPI.fazerRequisicao(
      body.codigoEmpresa,
      '/v1/fiscal/impostos/calculo',
      'POST',
      payload
    );

    console.log('✅ Resposta da API Sankhya:', response);

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('❌ Erro ao calcular impostos:', error);
    console.error('❌ Detalhes do erro:', error.response?.data);

    return NextResponse.json(
      { 
        error: error.response?.data?.error?.message || error.message || 'Erro ao calcular impostos',
        details: error.response?.data || null
      },
      { status: error.response?.status || 500 }
    );
  }
}

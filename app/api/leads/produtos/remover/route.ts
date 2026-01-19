
import { NextResponse } from 'next/server';
import { removerProdutoLead } from '@/lib/oracle-leads-service';

export async function POST(request: Request) {
  try {
    const { codItem, codLead } = await request.json();

    if (!codItem || !codLead) {
      return NextResponse.json(
        { error: 'codItem e codLead são obrigatórios' },
        { status: 400 }
      );
    }

    const idEmpresa = 1; // ID_EMPRESA fixo

    console.log('➖ Removendo produto:', { codItem, codLead });

    const resultado = await removerProdutoLead(codItem, codLead, idEmpresa);

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('❌ Erro ao remover produto:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao remover produto' },
      { status: 500 }
    );
  }
}

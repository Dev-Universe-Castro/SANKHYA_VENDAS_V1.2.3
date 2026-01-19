
import { NextResponse } from 'next/server';
import { consultarProdutosLead } from '@/lib/oracle-leads-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codLead = searchParams.get('codLead');

    if (!codLead) {
      return NextResponse.json(
        { error: 'codLead é obrigatório' },
        { status: 400 }
      );
    }

    const idEmpresa = 1; // ID_EMPRESA fixo

    console.log('📦 Consultando produtos do lead:', codLead);
    
    const produtos = await consultarProdutosLead(codLead, idEmpresa);
    
    console.log(`📤 Retornando ${produtos.length} produtos`);
    return NextResponse.json(produtos);
    
  } catch (error: any) {
    console.error('❌ Erro ao consultar produtos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar produtos' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

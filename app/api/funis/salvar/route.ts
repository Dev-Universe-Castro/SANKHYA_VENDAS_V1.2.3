
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { salvarFunil } from '@/lib/oracle-funis-service';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || 1;

    const data = await request.json();
    console.log('💾 [API /funis/salvar] Salvando funil:', { data, idEmpresa });

    const funil = await salvarFunil(data, idEmpresa);
    
    // Garantir que o objeto é serializável
    const funilSerializavel = {
      CODFUNIL: funil.CODFUNIL,
      NOME: funil.NOME,
      DESCRICAO: funil.DESCRICAO,
      COR: funil.COR,
      ATIVO: funil.ATIVO,
      DATA_CRIACAO: funil.DATA_CRIACAO,
      DATA_ATUALIZACAO: funil.DATA_ATUALIZACAO
    };
    
    console.log('✅ [API /funis/salvar] Funil salvo com sucesso:', funilSerializavel);
    return NextResponse.json(funilSerializavel);
  } catch (error: any) {
    console.error('❌ [API /funis/salvar] Erro ao salvar funil:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar funil' },
      { status: 500 }
    );
  }
}

// Desabilitar cache para esta rota
export const dynamic = 'force-dynamic';
export const revalidate = 0;

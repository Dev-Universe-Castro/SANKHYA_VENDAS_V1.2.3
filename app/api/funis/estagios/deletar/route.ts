
import { NextResponse } from 'next/server';
import { deletarEstagio } from '@/lib/oracle-funis-service';
import { cookies } from 'next/headers';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codEstagio = searchParams.get('codEstagio');
    
    if (!codEstagio) {
      return NextResponse.json(
        { error: 'CODESTAGIO é obrigatório' },
        { status: 400 }
      );
    }
    
    // Obter usuário do cookie para pegar ID_EMPRESA
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA;
    
    console.log('🗑️ API - Deletando estágio:', { codEstagio, idEmpresa });
    
    // Deletar estágio no Oracle
    await deletarEstagio(codEstagio, idEmpresa);
    
    console.log('✅ API - Estágio deletado com sucesso');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ API - Erro ao deletar estágio:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar estágio' },
      { status: 500 }
    );
  }
}

// Desabilitar cache para esta rota
export const dynamic = 'force-dynamic';
export const revalidate = 0;

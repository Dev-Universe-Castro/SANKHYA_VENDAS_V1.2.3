
import { NextResponse } from 'next/server';
import { consultarEstagiosFunil } from '@/lib/oracle-funis-service';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codFunil = searchParams.get('codFunil');
    
    if (!codFunil) {
      return NextResponse.json(
        { error: 'CODFUNIL é obrigatório' },
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
    
    console.log('🔍 API - Consultando estágios do funil:', { codFunil, idEmpresa });
    
    // Consultar estágios no Oracle
    const estagios = await consultarEstagiosFunil(codFunil, idEmpresa);
    
    console.log(`✅ API - ${estagios.length} estágios encontrados`);
    return NextResponse.json(estagios);
  } catch (error: any) {
    console.error('❌ API - Erro ao consultar estágios:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar estágios' },
      { status: 500 }
    );
  }
}

// Desabilitar cache para esta rota
export const dynamic = 'force-dynamic';
export const revalidate = 0;

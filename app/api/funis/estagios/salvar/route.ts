
import { NextResponse } from 'next/server';
import { salvarEstagio } from '@/lib/oracle-funis-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('📥 API - Recebendo dados do estágio:', JSON.stringify(data, null, 2));
    
    // Obter usuário do cookie para pegar ID_EMPRESA
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      console.error('❌ API - Usuário não autenticado');
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA;
    
    console.log('🔐 API - ID_EMPRESA do usuário:', idEmpresa);
    
    if (!data.CODFUNIL) {
      console.error('❌ API - CODFUNIL não fornecido');
      return NextResponse.json(
        { error: 'CODFUNIL é obrigatório' },
        { status: 400 }
      );
    }
    
    if (!data.NOME || data.NOME.trim() === '') {
      console.error('❌ API - Nome do estágio vazio');
      return NextResponse.json(
        { error: 'Nome do estágio é obrigatório' },
        { status: 400 }
      );
    }
    
    if (typeof data.ORDEM !== 'number') {
      console.error('❌ API - ORDEM inválida');
      return NextResponse.json(
        { error: 'ORDEM do estágio é obrigatória' },
        { status: 400 }
      );
    }
    
    // Preparar dados do estágio, removendo IDs temporários
    const estagioData = {
      ...data,
      CODESTAGIO: String(data.CODESTAGIO || '').startsWith('temp-') ? undefined : data.CODESTAGIO
    };
    
    // Salvar estágio no Oracle
    console.log('💾 API - Iniciando salvamento no Oracle...');
    const estagio = await salvarEstagio(estagioData, idEmpresa);
    
    if (!estagio) {
      console.error('❌ API - Estágio retornou vazio após salvar');
      return NextResponse.json(
        { error: 'Estágio retornou vazio após salvar' },
        { status: 500 }
      );
    }
    
    console.log('✅ API - Estágio salvo com sucesso:', JSON.stringify(estagio, null, 2));
    return NextResponse.json(estagio);
  } catch (error: any) {
    console.error('❌ API - Erro ao salvar estágio:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar estágio' },
      { status: 500 }
    );
  }
}

// Desabilitar cache para esta rota
export const dynamic = 'force-dynamic';
export const revalidate = 0;


import { NextResponse } from 'next/server';
import { criarAtividade } from '@/lib/oracle-leads-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const atividadeData = await request.json();

    // Obter usuário autenticado do cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let currentUser;
    try {
      currentUser = JSON.parse(userCookie.value);
    } catch (e) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const idEmpresa = 1; // ID_EMPRESA fixo
    
    // Adicionar CODUSUARIO do usuário autenticado
    atividadeData.CODUSUARIO = currentUser.id;

    // Extrair TITULO e DESCRICAO se vier no formato antigo "TITULO|DESCRICAO"
    if (atividadeData.DESCRICAO && atividadeData.DESCRICAO.includes('|')) {
      const [titulo, descricao] = atividadeData.DESCRICAO.split('|');
      atividadeData.TITULO = titulo;
      atividadeData.DESCRICAO = descricao;
    }

    console.log('➕ Criando nova atividade:', atividadeData);

    const novaAtividade = await criarAtividade(atividadeData, idEmpresa);

    return NextResponse.json(novaAtividade);
  } catch (error: any) {
    console.error('❌ Erro ao criar atividade:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar atividade' },
      { status: 500 }
    );
  }
}

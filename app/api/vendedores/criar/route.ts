
import { NextResponse } from 'next/server';
import { criarVendedor } from '@/lib/vendedores-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Obter ID_EMPRESA do usuário logado
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie?.value) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const usuario = JSON.parse(userCookie.value);
    const idEmpresa = usuario.ID_EMPRESA || usuario.id_empresa;

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }
    
    console.log("🔄 API Route - Recebendo requisição para criar vendedor:", body);
    
    const resultado = await criarVendedor({
      ...body,
      idEmpresa
    });
    
    console.log("✅ API Route - Vendedor criado com sucesso:", resultado);
    
    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('❌ API Route - Erro ao criar vendedor:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: error.message || 'Erro ao criar vendedor' },
      { status: 500 }
    );
  }
}

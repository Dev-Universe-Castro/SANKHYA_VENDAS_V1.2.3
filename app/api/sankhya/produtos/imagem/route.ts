
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sankhyaDynamicAPI } from '@/lib/sankhya-dynamic-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codProd = searchParams.get('codProd');

    if (!codProd) {
      return NextResponse.json({ error: 'Código do produto não informado' }, { status: 400 });
    }

    console.log(`🖼️ Buscando imagem do produto ${codProd}`);

    // Obter usuário do cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      console.error('❌ Cookie de usuário não encontrado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(decodeURIComponent(userCookie.value));
    const idEmpresa = user.ID_EMPRESA;

    if (!idEmpresa) {
      console.error('❌ Usuário sem empresa vinculada');
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    console.log(`🔑 Usando autenticação dinâmica (OAuth2 ou Legacy) para empresa ${idEmpresa}`);

    // Usar a API dinâmica que detecta automaticamente OAuth2 ou Legacy
    const endpoint = `/gateway/v1/mge/Produto@IMAGEM@CODPROD=${codProd}.dbimage`;
    
    const imageData = await sankhyaDynamicAPI.fazerRequisicao(
      idEmpresa,
      endpoint,
      'GET'
    );

    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable'
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar imagem do produto:', error.message);
    
    if (error.response?.status === 404) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
    }

    if (error.response?.status === 429) {
      return NextResponse.json({ error: 'Muitas requisições, tente novamente' }, { status: 429 });
    }

    return NextResponse.json(
      { error: 'Erro ao buscar imagem do produto' },
      { status: 500 }
    );
  }
}

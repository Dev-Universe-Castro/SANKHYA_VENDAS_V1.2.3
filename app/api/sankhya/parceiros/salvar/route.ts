import { NextResponse } from 'next/server';
import { sankhyaDynamicAPI } from '@/lib/sankhya-dynamic-api';
import { cacheService } from '@/lib/cache-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Verificar autenticação via cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie?.value) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let user;
    try {
      user = JSON.parse(userCookie.value);
    } catch {
      return NextResponse.json({ error: 'Cookie de usuário inválido' }, { status: 401 });
    }

    const body = await request.json();

    // Obter ID_EMPRESA do usuário
    const idEmpresa = user.idEmpresa;

    if (!idEmpresa) {
      return NextResponse.json({ 
        error: 'Usuário não possui empresa vinculada'
      }, { status: 400 });
    }

    console.log(`🔄 API Route - Salvando parceiro para empresa ${idEmpresa}:`, body);

    const payload = {
      requestBody: {
        dataSet: {
          rootEntity: 'Parceiro',
          includePresentationFields: 'S',
          entity: {
            fieldset: {
              list: Object.keys(body).join(', ')
            },
            ...body
          }
        }
      }
    };

    const resultado = await sankhyaDynamicAPI.fazerRequisicao(
      idEmpresa,
      '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json',
      'POST',
      payload
    );

    // Invalidar cache de parceiros
    cacheService.invalidateParceiros();
    console.log('✅ Cache de parceiros invalidado após salvar');

    return NextResponse.json({
      ...resultado,
      needsSync: true,
      message: body.CODPARC 
        ? 'Parceiro editado com sucesso no Sankhya. Aguarde a sincronização para visualizar as alterações no sistema.' 
        : 'Parceiro cadastrado com sucesso no Sankhya. Aguarde a sincronização para visualizar no sistema.'
    }, { status: 200 });
  } catch (error: any) {
    console.error('❌ API Route - Erro ao salvar parceiro:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    return NextResponse.json(
      { error: error.message || 'Erro ao salvar parceiro' },
      { status: 500 }
    );
  }
}
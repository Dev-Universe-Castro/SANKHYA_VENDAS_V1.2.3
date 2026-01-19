
import { NextResponse } from 'next/server';
import { criarPedidoVenda } from '@/lib/pedidos-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Obter usuário do cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    console.log('🍪 Cookie presente:', !!userCookie);
    
    if (!userCookie) {
      console.error('❌ Cookie de usuário não encontrado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(decodeURIComponent(userCookie.value));
    
    console.log('👤 Usuário completo do cookie:', user);
    console.log('🔍 ID_EMPRESA:', user.ID_EMPRESA);
    
    if (!user) {
      console.error('❌ Usuário não encontrado no cookie');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Obter ID_EMPRESA do usuário
    const idEmpresa = user.ID_EMPRESA;
    
    console.log('🏢 ID Empresa:', idEmpresa);
    
    if (!idEmpresa) {
      console.error('❌ Usuário sem empresa vinculada');
      return NextResponse.json({ 
        error: 'Usuário não possui empresa vinculada',
        success: false 
      }, { status: 400 });
    }

    // Validar se o usuário pode criar pedidos
    const { accessControlService } = await import('@/lib/access-control-service');
    
    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);
      
      if (!accessControlService.canCreateOrEdit(userAccess)) {
        const errorMsg = accessControlService.getAccessDeniedMessage(userAccess);
        return NextResponse.json({ error: errorMsg, success: false }, { status: 403 });
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message, success: false }, { status: 403 });
    }

    const body = await request.json();
    
    console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
    console.log(`🔄 API Route - Criando pedido para empresa ${idEmpresa}:`, body);
    
    // Verificar se há regra de imposto selecionada para cálculo
    let resultadoImpostos = null;
    if (body.REGRA_IMPOSTO) {
      console.log('📊 Regra de imposto detectada - realizando cálculo...');
      const regraImposto = body.REGRA_IMPOSTO;
      
      try {
        const { impostosCalculoService } = await import('@/lib/impostos-calculo-service');
        
        const payloadCalculo = {
          notaModelo: regraImposto.NOTA_MODELO,
          codigoCliente: Number(body.CODPARC),
          codigoEmpresa: regraImposto.CODIGO_EMPRESA || idEmpresa,
          finalidadeOperacao: regraImposto.FINALIDADE_OPERACAO,
          codigoNatureza: regraImposto.CODIGO_NATUREZA,
          despesasAcessorias: {
            frete: body.VLRFRETE || 0,
            seguro: 0,
            outros: body.VLOUTROS || 0
          },
          produtos: body.itens.map((item: any) => ({
            codigoProduto: Number(item.CODPROD),
            quantidade: item.QTDNEG,
            valorUnitario: item.VLRUNIT,
            unidade: item.CODVOL || 'UN'
          }))
        };

        console.log('📋 Payload de cálculo de impostos:', JSON.stringify(payloadCalculo, null, 2));
        
        const resultadoCalculo = await impostosCalculoService.calcularImpostos(idEmpresa, payloadCalculo);
        
        if (resultadoCalculo.success) {
          console.log('✅ Cálculo de impostos realizado com sucesso:', resultadoCalculo);
          resultadoImpostos = {
            success: true,
            regraAplicada: regraImposto.NOME,
            produtos: resultadoCalculo.produtos,
            totais: resultadoCalculo.totais
          };
        } else {
          console.warn('⚠️ Erro no cálculo de impostos (continuando com criação do pedido):', resultadoCalculo.error);
          resultadoImpostos = {
            success: false,
            error: resultadoCalculo.error,
            regraAplicada: regraImposto.NOME
          };
        }
      } catch (calcError: any) {
        console.warn('⚠️ Falha ao calcular impostos (continuando com criação do pedido):', calcError.message);
        resultadoImpostos = {
          success: false,
          error: calcError.message
        };
      }
    }

    const resultado = await criarPedidoVenda({
      ...body,
      idEmpresa
    });
    
    console.log("✅ API Route - Pedido criado com sucesso");
    
    // Incluir resultado do cálculo de impostos na resposta
    return NextResponse.json({
      ...resultado,
      impostos: resultadoImpostos
    });
  } catch (error: any) {
    console.error('❌ API Route - Erro ao criar pedido:', {
      message: error.message,
      response: error.response?.data
    });
    
    const errorResponse = error.response?.data;
    const errorMessage = errorResponse?.error?.details || 
                        errorResponse?.error?.message || 
                        errorResponse?.statusMessage ||
                        error.message || 
                        'Erro ao criar pedido';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorResponse,
        success: false
      },
      { status: errorResponse?.statusCode || 500 }
    );
  }
}

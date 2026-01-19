import { NextResponse } from 'next/server';
import { salvarLead, adicionarProdutoLead } from '@/lib/oracle-leads-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      console.error('❌ [API /leads/salvar] Usuário não autenticado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    const data = await request.json();

    console.log('📥 [API /leads/salvar] Recebendo dados:');
    console.log('   - NOME:', data.NOME);
    console.log('   - CODFUNIL:', data.CODFUNIL);
    console.log('   - CODESTAGIO:', data.CODESTAGIO);
    console.log('   - Usuário:', user.CODUSUARIO);

    const idEmpresa = user.ID_EMPRESA || 1;
    const codUsuarioCriador = user.id;

    // Validar se o usuário pode criar leads
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      if (!accessControlService.canCreateOrEdit(userAccess)) {
        const errorMsg = accessControlService.getAccessDeniedMessage(userAccess);
        return NextResponse.json({ error: errorMsg }, { status: 403 });
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }

    // Validar se o CODFUNIL foi enviado e é válido
    if (!data.CODFUNIL) {
      console.error('❌ [API /leads/salvar] CODFUNIL não fornecido');
      return NextResponse.json({ error: 'O Funil é obrigatório para criar um negócio.' }, { status: 400 });
    }

    // Validar se o CODESTAGIO foi enviado e é válido
    if (!data.CODESTAGIO) {
      console.error('❌ [API /leads/salvar] CODESTAGIO não fornecido');
      return NextResponse.json({ error: 'O Estágio é obrigatório para criar um negócio.' }, { status: 400 });
    }

    console.log('📥 Dados recebidos na API /api/leads/salvar:', JSON.stringify(data, null, 2));
    console.log('🔑 CODPARC recebido:', data.CODPARC);

    // Passar o ID do usuário criador se for um novo lead
    // A validação de acesso já garante que o usuário tem permissão para criar
    const finalCodUsuarioCriador = data.CODLEAD ? undefined : codUsuarioCriador;

    // Extrair produtos do leadData
    const produtos = data.PRODUTOS || [];
    delete data.PRODUTOS;

    console.log('🛒 Produtos extraídos do leadData:', {
      quantidade: produtos.length,
      produtos: produtos
    });

    // Salvar lead no Oracle
    const leadSalvo = await salvarLead(data, idEmpresa, finalCodUsuarioCriador);

    console.log('✅ Lead salvo com sucesso:', {
      CODLEAD: leadSalvo.CODLEAD,
      NOME: leadSalvo.NOME
    });

    // Salvar produtos vinculados APENAS se for um lead novo (sem CODLEAD no leadData)
    const isNovoLead = !data.CODLEAD;
    if (isNovoLead && produtos && produtos.length > 0 && leadSalvo.CODLEAD) {
      console.log(`📦 Iniciando salvamento de ${produtos.length} produto(s) para lead novo...`);

      // Aguardar um delay maior para garantir que o lead foi persistido
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < produtos.length; i++) {
        const produto = produtos[i];

        // Validar se o produto tem dados mínimos necessários
        if (!produto.CODPROD || !produto.DESCRPROD) {
          console.warn(`⚠️ Produto ${i + 1} sem dados essenciais, pulando:`, produto);
          continue;
        }

        console.log(`📌 Salvando produto ${i + 1}/${produtos.length}:`, {
          CODLEAD: String(leadSalvo.CODLEAD),
          CODPROD: produto.CODPROD,
          DESCRPROD: produto.DESCRPROD,
          QUANTIDADE: produto.QUANTIDADE || produto.QTDNEG || 1,
          VLRUNIT: produto.VLRUNIT || 0,
          VLRTOTAL: produto.VLRTOTAL || 0
        });

        try {
          await adicionarProdutoLead({
            CODLEAD: String(leadSalvo.CODLEAD),
            ID_EMPRESA: idEmpresa,
            CODPROD: produto.CODPROD,
            DESCRPROD: produto.DESCRPROD,
            QUANTIDADE: produto.QUANTIDADE || produto.QTDNEG || 1,
            VLRUNIT: produto.VLRUNIT || 0,
            VLRTOTAL: produto.VLRTOTAL || 0
          }, idEmpresa);
          console.log(`✅ Produto ${i + 1} salvo com sucesso`);

          // Delay entre produtos para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (produtoError: any) {
          console.error(`❌ Erro ao salvar produto ${i + 1}:`, produtoError);
          throw new Error(`Falha ao salvar produto "${produto.DESCRPROD}": ${produtoError.message}`);
        }
      }

      console.log('✅ Todos os produtos foram salvos com sucesso');
    } else {
      console.log('⚠️ Nenhum produto para salvar:', {
        temProdutos: produtos && produtos.length > 0,
        temCodLead: !!leadSalvo.CODLEAD,
        produtos: produtos
      });
    }

    return NextResponse.json(leadSalvo);
  } catch (error: any) {
    console.error('❌ Erro ao salvar lead:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar lead' },
      { status: 500 }
    );
  }
}
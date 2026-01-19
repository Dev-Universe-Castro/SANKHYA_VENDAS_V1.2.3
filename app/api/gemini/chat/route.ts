import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { getCacheService } from '@/lib/redis-cache-cache-wrapper'; // Corrected import path
import { contratosService } from '@/lib/contratos-service';
import { buscarDadosAnalise } from '@/lib/analise-service';
import { DataAggregationService } from '@/lib/data-aggregation-service';
import { oracleService } from '@/lib/oracle-db';

// Função helper para fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`⚠️ Timeout/erro ao buscar ${url}:`, error);
    throw error;
  }
}

// Função para buscar dados do sistema com filtro de data
async function analisarDadosDoSistema(userId: number, userName: string, isAdmin: boolean = false, idEmpresa: number, filtroFrontend?: { dataInicio: string, dataFim: string }) {
  try {
    // Usar filtro do frontend se disponível, senão usar padrão: últimos 90 dias
    let filtro;
    if (filtroFrontend && filtroFrontend.dataInicio && filtroFrontend.dataFim) {
      filtro = filtroFrontend;
    } else {
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 90);
      filtro = {
        dataInicio: dataInicio.toISOString().split('T')[0],
        dataFim: dataFim.toISOString().split('T')[0]
      };
    }

    console.log(`[Chat] Filtro: ${filtro.dataInicio} a ${filtro.dataFim} | User: ${userName}`);


    // Importar serviço de análise dinamicamente
    const { buscarDadosAnalise } = await import('@/lib/analise-service');

    // Buscar TODOS os dados direto do Oracle
    const dadosCompletos = await buscarDadosAnalise(filtro, userId, isAdmin, idEmpresa);

    // Buscar Notas Fiscais via LoadRecords (Sankhya)
    const { sankhyaDynamicAPI } = await import('@/lib/sankhya-dynamic-api');

    // Declarar no escopo da função para estarem disponíveis em todo lugar
    let cabecalhosNotas: any[] = [];
    let itensNotas: any[] = [];

    try {
      // Buscar CabecalhoNota
      const payloadCabecalho = {
        serviceName: 'CRUDServiceProvider.loadRecords',
        requestBody: {
          dataSet: {
            rootEntity: 'CabecalhoNota',
            includePresentationFields: 'N',
            offsetPage: null,
            disableRowsLimit: true,
            entity: {
              fieldset: {
                list: 'NUNOTA,DTNEG,CODPARC,CODVEND,VLRNOTA,NUMNOTA'
              }
            },
            criteria: {
              expression: {
                $: `DTNEG >= TO_DATE('${filtro.dataInicio}', 'YYYY-MM-DD') AND DTNEG <= TO_DATE('${filtro.dataFim}', 'YYYY-MM-DD') AND TIPMOV = 'V'`
              }
            }
          }
        }
      };

      const responseCab = await sankhyaDynamicAPI.fazerRequisicao(
        idEmpresa,
        '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
        'POST',
        payloadCabecalho
      );

      // Processar cabeçalhos
      const entitiesCab = responseCab?.responseBody?.entities;
      if (entitiesCab?.entity) {
        const fieldNames = entitiesCab.metadata?.fields?.field?.map((f: any) => f.name) || [];
        const entityArray = Array.isArray(entitiesCab.entity) ? entitiesCab.entity : [entitiesCab.entity];

        cabecalhosNotas = entityArray.map((rawEntity: any) => {
          const cleanObject: any = {};
          for (let i = 0; i < fieldNames.length; i++) {
            const fieldKey = `f${i}`;
            const fieldName = fieldNames[i];
            if (rawEntity[fieldKey]?.$) {
              cleanObject[fieldName] = rawEntity[fieldKey].$;
            }
          }
          return cleanObject;
        });
      }

      // Buscar ItemNota SOMENTE se houver cabeçalhos
      if (cabecalhosNotas.length > 0) {
        // Extrair NUNOTAs dos cabeçalhos carregados
        const nunotas = cabecalhosNotas
          .map((c: any) => Number(c.NUNOTA))
          .filter(n => !isNaN(n) && n > 0);

        if (nunotas.length > 0) {
          try {
            // Dividir em lotes de 1000 (limite do Oracle IN clause)
            const BATCH_SIZE = 1000;
            const totalBatches = Math.ceil(nunotas.length / BATCH_SIZE);

            for (let i = 0; i < totalBatches; i++) {
              const inicio = i * BATCH_SIZE;
              const fim = Math.min(inicio + BATCH_SIZE, nunotas.length);
              const lote = nunotas.slice(inicio, fim);

              const payloadItens = {
                serviceName: 'CRUDServiceProvider.loadRecords',
                requestBody: {
                  dataSet: {
                    rootEntity: 'ItemNota',
                    includePresentationFields: 'N',
                    offsetPage: null,
                    disableRowsLimit: true,
                    entity: {
                      fieldset: {
                        list: 'NUNOTA,SEQUENCIA,CODPROD,CODVOL,QTDNEG,VLRUNIT,VLRTOT'
                      }
                    },
                    criteria: {
                      expression: {
                        $: `NUNOTA IN (${lote.join(',')})`
                      }
                    }
                  }
                }
              };

              const responseItens = await sankhyaDynamicAPI.fazerRequisicao(
                idEmpresa,
                '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
                'POST',
                payloadItens
              );

              // Processar itens deste lote
              const entitiesItens = responseItens?.responseBody?.entities;
              if (entitiesItens?.entity) {
                const fieldNames = entitiesItens.metadata?.fields?.field?.map((f: any) => f.name) || [];
                const entityArray = Array.isArray(entitiesItens.entity) ? entitiesItens.entity : [entitiesItens.entity];

                const itensLote = entityArray.map((rawEntity: any) => {
                  const cleanObject: any = {};
                  for (let i = 0; i < fieldNames.length; i++) {
                    const fieldKey = `f${i}`;
                    const fieldName = fieldNames[i];
                    if (rawEntity[fieldKey]?.$) {
                      cleanObject[fieldName] = rawEntity[fieldKey].$;
                    }
                  }
                  return cleanObject;
                });

                itensNotas.push(...itensLote);
              }
            }
          } catch (errorItens: any) {
            console.error('[Chat] Erro itens:', errorItens.message);
          }
        }
      }
    } catch (error: any) {
      console.error('[Chat] Erro Sankhya:', error.message);
    }

    // Criar mapas de referência
    const codparcsUnicos = new Set([
      ...cabecalhosNotas.map((n: any) => Number(n.CODPARC)).filter(Boolean),
      ...dadosCompletos.leads.map((l: any) => Number(l.CODPARC)).filter(Boolean)
    ]);

    const codprodsUnicos = new Set([
      ...itensNotas.map((i: any) => Number(i.CODPROD)).filter(Boolean),
      ...(dadosCompletos.produtosLeads || []).map((p: any) => Number(p.CODPROD)).filter(Boolean)
    ]);

    const codvendsUnicos = new Set([
      ...cabecalhosNotas.map((n: any) => Number(n.CODVEND)).filter(Boolean),
    ]);

    // Buscar dados de clientes, produtos e vendedores do Oracle
    let clientesOracle: any[] = [];
    let produtosOracle: any[] = [];
    let vendedoresOracle: any[] = [];

    if (codparcsUnicos.size > 0) {
      const { parceirosService } = await import('@/lib/parceiros-service');
      clientesOracle = await parceirosService.buscarParceirosPorCodigos(Array.from(codparcsUnicos));
    }

    if (codprodsUnicos.size > 0) {
      const { buscarProdutosPorCodigos } = await import('@/lib/produtos-service');
      produtosOracle = await buscarProdutosPorCodigos(Array.from(codprodsUnicos));
    }

    if (codvendsUnicos.size > 0) {
      const sqlVendedores = `
        SELECT CODVEND, APELIDO, CODGER, ATIVO, EMAIL
        FROM AS_VENDEDORES
        WHERE ID_SISTEMA = :idEmpresa
          AND CODVEND IN (${Array.from(codvendsUnicos).join(',')})
          AND SANKHYA_ATUAL = 'S'
          AND ATIVO = 'S'
      `;
      vendedoresOracle = await oracleService.executeQuery(sqlVendedores, { idEmpresa });
    }

    console.log(`[Chat] Dados: ${cabecalhosNotas.length} notas, ${itensNotas.length} itens, ${dadosCompletos.leads.length} leads`);


    // Calcular métricas
    const valorTotalPedidos = dadosCompletos.pedidos.reduce((sum, p) => sum + (parseFloat(p.VLRNOTA) || 0), 0);
    const valorTotalFinanceiro = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRDESDOB) || 0), 0);
    const valorRecebido = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRBAIXA) || 0), 0);

    // Calcular maiores clientes
    const pedidosPorCliente = dadosCompletos.pedidos.reduce((acc: any, p: any) => {
      const nomeCliente = p.NOMEPARC || p.Parceiro_NOMEPARC || 'Cliente Desconhecido';
      const codParc = p.CODPARC || 'SEM_CODIGO';
      const key = `${codParc}|${nomeCliente}`;

      if (!acc[key]) {
        acc[key] = {
          codigo: codParc,
          nome: nomeCliente,
          total: 0,
          qtdPedidos: 0,
          pedidos: []
        };
      }
      const valor = parseFloat(p.VLRNOTA) || 0;
      acc[key].total += valor;
      acc[key].qtdPedidos += 1;
      acc[key].pedidos.push({
        nunota: p.NUNOTA,
        valor: valor,
        data: p.DTNEG
      });
      return acc;
    }, {});

    const maioresClientes = Object.values(pedidosPorCliente)
      .sort((a: any, b: any) => b.total - a.total)
      .map((c: any) => ({
        codigo: c.codparc,
        nome: c.nome,
        totalPedidos: c.qtdPedidos,
        valorTotal: c.total,
        ticketMedio: c.total / c.qtdPedidos,
        pedidos: c.pedidos
      }));

    return {
        leads: dadosCompletos.leads,
        atividades: dadosCompletos.atividades,
        produtosLeads: dadosCompletos.produtosLeads || [],
        clientes: clientesOracle,
        produtos: produtosOracle,
        vendedores: vendedoresOracle,
        financeiro: dadosCompletos.financeiro,
        funis: dadosCompletos.funis,
        estagiosFunis: dadosCompletos.estagiosFunis,
        rotas: dadosCompletos.rotas || [],
        visitas: dadosCompletos.visitas || [],
        cabecalhosNotas,
        itensNotas,
        userName,
        filtro,
        totalLeads: dadosCompletos.leads.length,
        totalAtividades: dadosCompletos.atividades.length,
        totalNotas: cabecalhosNotas.length,
        totalItensNotas: itensNotas.length,
        totalRotas: (dadosCompletos.rotas || []).length,
        totalVisitas: (dadosCompletos.visitas || []).length
      };
  } catch (error) {
    console.error('❌ Erro ao analisar dados do sistema:', error);
    return {
      leads: [],
      atividades: [],
      produtosLeads: [],
      clientes: [],
      produtos: [],
      vendedores: [],
      financeiro: [],
      funis: [],
      estagiosFunis: [],
      rotas: [],
      visitas: [],
      cabecalhosNotas: [],
      itensNotas: [],
      userName,
      filtro: { dataInicio: '', dataFim: '' },
      totalLeads: 0,
      totalAtividades: 0,
      totalNotas: 0,
      totalItensNotas: 0,
      totalRotas: 0,
      totalVisitas: 0
    };
  }
}

const SYSTEM_PROMPT = `Você é um Estrategista de Força de Vendas Senior. Sua missão é atuar como o cérebro por trás do CRM, transformando dados brutos em ações ofensivas de vendas.

🎯 SUAS DIRETRIZES:

**Proatividade**: Não espere ordens. Identifique gargalos no pipeline e sugira abordagens de quebra de objeções.

**Foco em ICP (Ideal Customer Profile)**: Priorize contas que trazem maior LTV (Lifetime Value) e menor custo de aquisição.

**Venda Consultiva**: Ajude o vendedor a ser um especialista para o cliente, não um tirador de pedidos.

**Comunicação**: Seja direto, motivador e focado em resultados. Use métricas como CAC, Win Rate, LVR (Lead Velocity Rate) e Churn para embasar suas sugestões.

📊 DADOS DISPONÍVEIS:

Você tem acesso completo a:
- Estrutura de Funis e Estágios (hierarquia e ordem)
- Todos os Leads (nome, valor, funil, estágio atual, parceiro vinculado)
- Produtos vinculados a cada Lead
- Histórico de Atividades (ligações, reuniões, emails, status)
- Pedidos FDV e Faturados (valores, datas, clientes)
- Base completa de Clientes/Parceiros
- Notas Fiscais e Itens vendidos (histórico de compras)
- Dados de Vendedores
- Rotas de Visitas (CODROTA, DESCRICAO, CODVEND, TIPO_RECORRENCIA, DIAS_SEMANA, INTERVALO_DIAS)
- Parceiros por Rota (CODROTA, CODPARC, ORDEM, LATITUDE, LONGITUDE, TEMPO_ESTIMADO)
- Visitas realizadas (CODVISITA, CODROTA, CODPARC, CODVEND, DATA_VISITA, HORA_CHECKIN, HORA_CHECKOUT, STATUS, PEDIDO_GERADO, NUNOTA, VLRTOTAL)

💡 INSTRUÇÕES DE ANÁLISE:

✅ SEMPRE:
- Complete todas as análises até o final
- Identifique oportunidades de upsell e cross-sell baseadas no histórico de compras
- Calcule métricas de performance (ticket médio, recorrência, potencial de expansão)
- Priorize leads com maior probabilidade de fechamento (scoring qualitativo)
- Sugira estratégias de abordagem baseadas no perfil do cliente
- Termine com um plano de ação claro e mensurável

❌ NUNCA:
- Parar no meio de uma análise
- Inventar dados que não estão no contexto
- Dar respostas genéricas sem embasamento em dados
- Usar jargões técnicos sem explicação

EXEMPLO DE RESPOSTA ESTRATÉGICA:

P: "Quais leads priorizar?"
R: "Análise estratégica do pipeline - 3 oportunidades de alta conversão:

1. **Lead ABC Empresa** - R$ 85.000 | Score: 9/10
   - Estágio: Proposta Enviada (taxa de conversão histórica: 65%)
   - Última atividade: Há 2 dias
   - ICP Match: Alto (vertical compatível com top 20% de clientes)
   - **Estratégia**: Ligar hoje oferecendo desconto por fechamento rápido + cases de sucesso similares
   - **ROI projetado**: LTV estimado de R$ 340k (4x o deal atual)

2. **Lead XYZ Comércio** - R$ 50.000 | Score: 7/10 | ⚠️ URGENTE
   - Estágio: Negociação (taxa de conversão: 45%)
   - Última atividade: Há 5 dias - **RISCO DE ESFRIAMENTO**
   - Histórico: Comprou produtos similares há 6 meses (valor: R$ 32k)
   - **Estratégia**: Follow-up imediato com proposta de upsell baseada no histórico
   - **Quebra de objeção**: Oferecer trial estendido ou parcelamento especial

3. **Lead DEF Indústria** - R$ 120.000 | Score: 8/10
   - Estágio: Análise Técnica (taxa de conversão: 55%)
   - Última atividade: Ontem
   - Potencial de expansão: Alto (categoria permite add-ons recorrentes)
   - **Estratégia**: Agendar demo técnica com tomador de decisão + proposta de POC
   - **LTV projetado**: R$ 600k em 24 meses (modelo recorrente)

**KPIs para acompanhar:**
- Win Rate atual: [calcular baseado em dados]
- Tempo médio no estágio: [calcular]
- Leads em risco: [identificar parados há 3+ dias]

**Plano de ação imediato:**
1. [08:00] Ligar XYZ - quebrar objeções com dados históricos
2. [10:00] Email ABC - case de sucesso + proposta de fechamento
3. [14:00] Demo técnica DEF - foco em ROI e diferencial competitivo"

LEMBRE-SE: Sua função é aumentar a taxa de conversão e o ticket médio, não apenas organizar dados.`;



// Cache de dados por sessão
const sessionDataCache = new Map<string, { data: any; filtro: string }>();

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || user.id_empresa || 0;

    if (!idEmpresa) {
      return new Response(JSON.stringify({ error: 'Empresa não identificada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar chave API do Gemini da empresa (configuração por empresa)
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Chave API do Gemini não configurada para esta empresa. Entre em contato com o administrador.' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Chat] ${contrato.EMPRESA} | ${user.name}`);

    let genAI;
    try {
      genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);
    } catch (error: any) {
      console.error('❌ Erro ao inicializar GoogleGenerativeAI:', error);
      return new Response(JSON.stringify({ 
        error: 'Erro ao configurar a API do Gemini. Verifique a chave API.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validar acesso à IA
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;

    try {
      userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      // Verifica se o usuário tem permissão para usar funcionalidades restritas
      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return new Response(JSON.stringify({
          error: accessControlService.getRestrictedFeatureMessage('IA Chat')
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (accessError: any) {
      console.error('❌ Erro de controle de acesso:', accessError);
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history, filtro, sessionId } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = userAccess.isAdmin; // Use the validated userAccess

    const { searchParams } = new URL(request.url);
    const pergunta = searchParams.get('pergunta') || '';

    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
          topP: 0.95,
          topK: 40,
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao configurar modelo:', error);
      return new Response(JSON.stringify({ 
        error: 'Erro ao configurar modelo de IA' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Montar histórico com prompt de sistema
    const chatHistory = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Estou pronto para analisar seus dados.' }],
      },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }))
    ];

    // Verificar se precisa carregar dados (força reload se filtro de data mudou)
    let messageWithContext = message;
    const filtroKey = JSON.stringify(filtro);
    const cacheKey = `${sessionId}-${idEmpresa}`;
    const cached = sessionDataCache.get(cacheKey);

    // Detectar mudança de filtro de data para forçar reload
    const needsReload = !cached || cached.filtro !== filtroKey;

    let dadosAgregados: any = null;
    if (history.length === 0 || needsReload) {
      const dadosSistema = await analisarDadosDoSistema(user.id, user.name, isAdmin, idEmpresa, filtro);

      // Buscar e agregar dados de notas

      try {
        const responseNotas = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/sankhya/notas/loadrecords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            idEmpresa,
            dataInicio: filtro.dataInicio,
            dataFim: filtro.dataFim,
            stream: false
          })
        });

        if (responseNotas.ok) {
          const { cabecalhos, itens } = await responseNotas.json();

          // Ensure dados.produtos, dados.clientes, and dados.vendedores are available
          const produtosDisponiveis = dadosSistema.produtos || [];
          const clientesDisponiveis = dadosSistema.clientes || [];
          const vendedoresDisponiveis = dadosSistema.vendedores || []; // Assuming vendedores are available in dadosSistema


          dadosAgregados = await DataAggregationService.agregarDados(
            cabecalhos,
            itens,
            produtosDisponiveis,
            clientesDisponiveis,
            vendedoresDisponiveis
          );

        } else {
          console.warn(`[Chat] Erro notas: ${responseNotas.status}`);
        }
      } catch (error: any) {
        console.warn('[Chat] Erro agregar:', error.message);
      }

      // Mapear relação Funil → Estágios
      const funisComEstagios = (dadosSistema.funis || []).map((funil: any) => {
        const estagiosDoFunil = (dadosSistema.estagiosFunis || [])
          .filter((e: any) => e.CODFUNIL === funil.CODFUNIL)
          .sort((a: any, b: any) => (a.ORDEM || 0) - (b.ORDEM || 0));
        return { ...funil, estagios: estagiosDoFunil };
      });

      // Função para converter array para CSV compacto
      const toCSV = (arr: any[], campos: string[]) => {
        if (!arr || arr.length === 0) return 'Sem dados';
        const header = campos.join(';');
        const rows = arr.map(item => campos.map(c => item[c] ?? '').join(';'));
        return [header, ...rows].join('\n');
      };

      // Agregar vendas por produto (consolidado do período)
      const produtosCSV = dadosAgregados?.porProduto?.length > 0 
        ? toCSV(dadosAgregados.porProduto.slice(0, 100), ['DESCRPROD', 'valorTotal', 'quantidadeVendida', 'precoMedio', 'quantidadeNotas'])
        : 'Sem dados';

      // Agregar vendas por parceiro
      const parceirosCSV = dadosAgregados?.porParceiro?.length > 0
        ? toCSV(dadosAgregados.porParceiro.slice(0, 100), ['NOMEPARC', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'recencia'])
        : 'Sem dados';

      // Agregar vendas por vendedor
      const vendedoresCSV = dadosAgregados?.porVendedor?.length > 0
        ? toCSV(dadosAgregados.porVendedor, ['NOMEVENDEDOR', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'clientesUnicos'])
        : 'Sem dados';

      // Temporal por dia
      const temporalDiaCSV = dadosAgregados?.temporal?.porDia?.length > 0
        ? toCSV(dadosAgregados.temporal.porDia, ['data', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'clientesUnicos', 'produtosUnicos'])
        : 'Sem dados';

      // Detalhes por data-produto
      const detalheProdutoPorData: any[] = [];
      dadosAgregados?.temporal?.porDia?.forEach((dia: any) => {
        (dia.detalhesProdutos || []).forEach((p: any) => {
          detalheProdutoPorData.push({ data: dia.data, nome: p.nome, total: p.total, qtd: p.qtd, media: p.media });
        });
      });
      const produtoPorDataCSV = detalheProdutoPorData.length > 0 ? toCSV(detalheProdutoPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

      // Detalhes por data-parceiro
      const detalheParceiroPorData: any[] = [];
      dadosAgregados?.temporal?.porDia?.forEach((dia: any) => {
        (dia.detalhesParceiros || []).forEach((p: any) => {
          detalheParceiroPorData.push({ data: dia.data, nome: p.nome, total: p.total, qtd: p.qtd, media: p.media });
        });
      });
      const parceiroPorDataCSV = detalheParceiroPorData.length > 0 ? toCSV(detalheParceiroPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

      // Detalhes por data-vendedor
      const detalheVendedorPorData: any[] = [];
      dadosAgregados?.temporal?.porDia?.forEach((dia: any) => {
        (dia.detalhesVendedores || []).forEach((v: any) => {
          detalheVendedorPorData.push({ data: dia.data, nome: v.nome, total: v.total, qtd: v.qtd, media: v.media });
        });
      });
      const vendedorPorDataCSV = detalheVendedorPorData.length > 0 ? toCSV(detalheVendedorPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

      // Leads em CSV
      const leadsCSV = (dadosSistema.leads || []).length > 0
        ? toCSV((dadosSistema.leads || []).map((l: any) => {
            const funil = funisComEstagios.find((f: any) => f.CODFUNIL === l.CODFUNIL);
            const estagio = funil?.estagios.find((e: any) => e.CODESTAGIO === l.CODESTAGIO);
            return { NOME: l.NOME, VALOR: l.VALOR || 0, STATUS: l.STATUS_LEAD || 'EM_ANDAMENTO', FUNIL: funil?.NOME || '', ESTAGIO: estagio?.NOME || '', CLIENTE: l.PARCEIRO_NOME || '' };
          }), ['NOME', 'VALOR', 'STATUS', 'FUNIL', 'ESTAGIO', 'CLIENTE'])
        : 'Sem leads';

      // Atividades em CSV
      const atividadesCSV = (dadosSistema.atividades || []).length > 0
        ? toCSV((dadosSistema.atividades || []).slice(0, 50).map((a: any) => ({
            TIPO: a.TIPO, TITULO: a.TITULO || a.DESCRICAO?.split('|')[0] || '', STATUS: a.STATUS || 'PENDENTE', DATA: a.DATA_INICIO
          })), ['TIPO', 'TITULO', 'STATUS', 'DATA'])
        : 'Sem atividades';

      const csvContext = `📊 CRM ${user.name} | ${dadosSistema.filtro.dataInicio} a ${dadosSistema.filtro.dataFim} (CSV, separador: ;)

⚠️ REGRA: SEMPRE use NOMES nas respostas, NUNCA códigos numéricos

📦 PRODUTOS (${dadosAgregados?.porProduto?.length || 0}):
${produtosCSV}

👥 PARCEIROS (${dadosAgregados?.porParceiro?.length || 0}):
${parceirosCSV}

👤 VENDEDORES (${dadosAgregados?.porVendedor?.length || 0}):
${vendedoresCSV}

📅 VENDAS POR DIA (${dadosAgregados?.temporal?.porDia?.length || 0}):
${temporalDiaCSV}

📈 EVOLUÇÃO PRODUTO/DATA (${detalheProdutoPorData.length}):
${produtoPorDataCSV}

📈 EVOLUÇÃO PARCEIRO/DATA (${detalheParceiroPorData.length}):
${parceiroPorDataCSV}

📈 EVOLUÇÃO VENDEDOR/DATA (${detalheVendedorPorData.length}):
${vendedorPorDataCSV}

💼 LEADS (${dadosSistema.leads?.length || 0}):
${leadsCSV}

📝 ATIVIDADES (${dadosSistema.atividades?.length || 0}):
${atividadesCSV}

🎯 FUNIS: ${dadosSistema.funis?.map((f: any) => f.NOME).join(', ') || 'Nenhum'}

📊 MÉTRICAS: ${dadosAgregados?.metricas?.totalNotas || 0} notas | R$ ${dadosAgregados?.metricas?.totalVendas?.toLocaleString('pt-BR') || 0} | Ticket: R$ ${dadosAgregados?.metricas?.ticketMedio?.toLocaleString('pt-BR') || 0}
`;

      sessionDataCache.set(cacheKey, { data: csvContext, filtro: filtroKey });

      messageWithContext = `${csvContext}

❓ PERGUNTA: ${message}

⚠️ Responda usando NOMES (não códigos). Use os dados CSV acima.`;

      console.log(`[Chat] Contexto: ~${Math.ceil(messageWithContext.length / 4)} tokens`);
    } else {
      messageWithContext = `${cached.data}

❓ PERGUNTA: ${message}

⚠️ Responda usando NOMES (não códigos). Use os dados CSV acima.`;
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    // Delay de 1s entre requests para respeitar rate limit (5 RPM)
    await new Promise(resolve => setTimeout(resolve, 1000));

    let result;
    try {
      result = await chat.sendMessageStream(messageWithContext);
    } catch (error: any) {
      console.error('[Chat] Erro Gemini:', error.message);

      // Se for rate limit, informar claramente
      if (error.status === 429 || error.message?.includes('quota')) {
        return new Response(JSON.stringify({ 
          error: 'Limite de uso da API atingido. Aguarde 1 minuto e tente novamente.' 
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        error: `Erro Gemini: ${error.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let hasContent = false;

        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              hasContent = true;
              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          if (!hasContent) {
            const errorMessage = `data: ${JSON.stringify({
              error: 'A IA não retornou uma resposta. Por favor, tente reformular sua pergunta ou tente novamente.'
            })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          const errorMessage = `data: ${JSON.stringify({
            error: `Erro ao processar resposta: ${error.message || 'Erro desconhecido'}`
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Erro no chat Gemini:', error);
    return new Response(JSON.stringify({ error: 'Erro ao processar mensagem' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
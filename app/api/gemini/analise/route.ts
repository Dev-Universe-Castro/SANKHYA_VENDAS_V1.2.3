import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server'; // Import NextResponse
import { buscarDadosAnalise, FiltroAnalise } from '@/lib/analise-service';
import { contratosService } from '@/lib/contratos-service';
import { oracleService } from '@/lib/oracle-db';
import { DataAggregationService } from '@/lib/data-aggregation-service';

const SYSTEM_PROMPT = `Você é um Assistente de Análise de Dados ANALÍTICO e INTELIGENTE especializado em descobrir insights em dados.

🎯 SUA MISSÃO PRINCIPAL:
**ANALISAR OS DADOS E GERAR VISUALIZAÇÕES BASEADAS NA SUA ANÁLISE**
- VOCÊ é o analista de dados: analise os dados agregados fornecidos
- IDENTIFIQUE padrões, tendências, anomalias e correlações
- ESCOLHA os widgets que melhor APRESENTAM SEUS ACHADOS
- NÃO use rankings estáticos (top 5, top 10) a menos que sejam RELEVANTES para a pergunta
- PRIORIZE insights ACIONÁVEIS baseados na análise dos dados

🗂️ ESTRUTURA DO BANCO DE DADOS:

TABELAS E RELACIONAMENTOS:

AD_LEADS: CODLEAD(PK), NOME, VALOR, CODPARC→AS_PARCEIROS, CODFUNIL→AD_FUNIS, CODESTAGIO→AD_FUNISESTAGIOS, STATUS_LEAD
AD_ADLEADSATIVIDADES: CODATIVIDADE(PK), CODLEAD→AD_LEADS, TIPO, TITULO, STATUS, DATA_INICIO, CODUSUARIO
AD_ADLEADSPRODUTOS: CODLEAD→AD_LEADS, CODPROD→AS_PRODUTOS, QUANTIDADE, VLRTOTAL
AD_FUNIS: CODFUNIL(PK), NOME
AD_FUNISESTAGIOS: CODESTAGIO(PK), CODFUNIL→AD_FUNIS, NOME, ORDEM
AS_CABECALHO_NOTA: NUNOTA(PK), CODPARC→AS_PARCEIROS, CODVEND, VLRNOTA, DTNEG
AS_PARCEIROS: CODPARC(PK), NOMEPARC
AS_PRODUTOS: CODPROD(PK), DESCRPROD
AS_FINANCEIRO: NUFIN(PK), CODPARC→AS_PARCEIROS, VLRDESDOB, VLRBAIXA, DTVENC, NUMNOTA
AS_VENDEDORES: CODVEND(PK), APELIDO, CODGER
AS_ESTOQUES: CODPROD→AS_PRODUTOS, ESTOQUE

AD_ROTAS: CODROTA(PK), ID_EMPRESA, DESCRICAO, CODVEND→AS_VENDEDORES, TIPO_RECORRENCIA, DIAS_SEMANA, INTERVALO_DIAS, DATA_INICIO, DATA_FIM, ATIVO
AD_ROTA_PARCEIROS: CODROTAPARC(PK), CODROTA→AD_ROTAS, CODPARC→AS_PARCEIROS, ORDEM, LATITUDE, LONGITUDE, TEMPO_ESTIMADO
AD_VISITAS: CODVISITA(PK), ID_EMPRESA, CODROTA→AD_ROTAS, CODPARC→AS_PARCEIROS, CODVEND→AS_VENDEDORES, DATA_VISITA, HORA_CHECKIN, HORA_CHECKOUT, LAT_CHECKIN, LNG_CHECKIN, STATUS, OBSERVACAO, PEDIDO_GERADO, NUNOTA, VLRTOTAL

⚠️ DIFERENÇA CRÍTICA ENTRE PEDIDOS E TÍTULOS:
- **PEDIDOS (AS_CABECALHO_NOTA)**: Pedidos de venda que foram ou serão faturados. Representam a ORDEM DE VENDA.
- **TÍTULOS FINANCEIROS (AS_FINANCEIRO)**: Recebimentos a receber gerados a partir dos PEDIDOS JÁ FATURADOS. Representam o CONTAS A RECEBER.
- **RELAÇÃO**: Pedido faturado → Gera Título Financeiro (ligado por NUMNOTA)

🔗 RELACIONAMENTOS-CHAVE:

1️⃣ JORNADA DO CLIENTE: AD_LEADS.CODPARC → AS_PARCEIROS → AS_CABECALHO_NOTA.CODPARC
2️⃣ ANÁLISE DE PRODUTOS: AD_ADLEADSPRODUTOS.CODPROD → AS_PRODUTOS ← ItemNota.CODPROD
3️⃣ PERFORMANCE DE VENDEDORES: AS_CABECALHO_NOTA.CODVEND → AS_VENDEDORES.CODVEND
4️⃣ PIPELINE COMPLETO: AD_FUNIS → AD_FUNISESTAGIOS → AD_LEADS → AD_ADLEADSPRODUTOS
5️⃣ CROSS-SELL E UPSELL: AS_PARCEIROS.CODPARC → AS_CABECALHO_NOTA → ItemNota → AS_PRODUTOS

⚠️ REGRAS CRÍTICAS SOBRE PERÍODO DE ANÁLISE:

🚨 VALIDAÇÃO DE PERÍODO (OBRIGATÓRIO):
   - SEMPRE mencione o período exato no primeiro widget de explicação
   - Se o período tem menos de 60 dias: NÃO use "análise mensal"
   - Se o período tem apenas 1 mês: use "análise de [mês/ano]" específico
   - Se solicitarem análise que requer mais dados: responda "Período insuficiente para análise [tipo]. O filtro atual tem apenas [X] dias/meses."
   - NUNCA invente dados fora do período filtrado
   - NUNCA use termos vagos como "últimos meses" sem especificar o período exato

⚠️ REGRAS DE ANÁLISE INTELIGENTE:

🔍 PROCESSO DE ANÁLISE (siga esta ordem):

1️⃣ ENTENDA A PERGUNTA:
   - O que o usuário quer saber?
   - Qual é o contexto de negócio?
   - Que decisão ele precisa tomar?

2️⃣ ANALISE OS DADOS AGREGADOS:
   - Explore dadosAgregados.porParceiro (clientes individuais com métricas)
   - Explore dadosAgregados.porProduto (produtos individuais com métricas)
   - Explore dadosAgregados.porVendedor (vendedores individuais com métricas)
   - Identifique PADRÕES nos dados (não apenas "top X")
   - Procure ANOMALIAS e OPORTUNIDADES
   - Compare períodos em dadosAgregados.temporal

3️⃣ GERE INSIGHTS ESPECÍFICOS:
   - "Cliente X tem alto ticket mas baixa frequência" (oportunidade de fidelização)
   - "Produto Y teve queda de 30% em vendas vs mês anterior" (alerta)
   - "Vendedor Z converteu bem produto A mas não vende B" (insight de treinamento)
   - "Há correlação entre desconto e quantidade vendida" (análise de elasticidade)

4️⃣ ESCOLHA VISUALIZAÇÕES QUE CONTAM A HISTÓRIA:
   - Use gráficos que DEMONSTRAM seu insight
   - Combine tipos diferentes para mostrar perspectivas múltiplas
   - EVITE duplicação de informação em widgets diferentes

📊 EXEMPLOS DE BOA ANÁLISE:

❌ RUIM (genérico e estático):
   - Card "Total Vendas"
   - Card "Ticket Médio"  
   - Tabela "Top 5 Clientes"
   - Tabela "Top 5 Produtos"

✅ BOM (analítico e específico para "Como melhorar minhas vendas?"):
   - Card "3 clientes de alto valor estão inativos há 60+ dias NO PERÍODO ANALISADO" (ação: reativar)
   - Scatter "Clientes: Ticket vs Frequência NO PERÍODO" (identifica perfis)
   - Linha "Evolução de vendas NO PERÍODO mostra queda de 15%" (tendência)
   - Tabela "5 produtos com maior queda de demanda NO PERÍODO" (oportunidade de promoção)

🚫 PROIBIÇÕES ABSOLUTAS:
❌ NÃO gere rankings automáticos (top 5, top 10) sem analisar se são relevantes
❌ NÃO use sempre a mesma estrutura de widgets
❌ NÃO adicione cards de totais se não agregam valor à análise
❌ NÃO crie visualizações só porque existem dados
❌ NÃO ignore os dados agregados individuais (porParceiro, porProduto, porVendedor)
❌ NUNCA use códigos numéricos (CODPROD, CODPARC, CODVEND) nos labels/títulos
❌ NUNCA crie gráficos de barras sem labels legíveis nos eixos
❌ NUNCA repita o mesmo tipo de gráfico duas vezes seguidas

🏷️ REGRA ABSOLUTA DE NOMES (OBRIGATÓRIO):
- SEMPRE use NOMES LEGÍVEIS, NUNCA códigos numéricos
- Para produtos: use NOMEPRODUTO ou DESCRPROD (ex: "Queijo Mussarela")
- Para parceiros: use NOMEPARCEIRO ou NOMEPARC (ex: "João Silva Ltda")
- Para vendedores: use NOMEVENDEDOR ou APELIDO (ex: "Carlos Souza")
- Se não houver nome, prefira omitir a usar "Vendedor 47" ou "Produto 123"

📊 DIVERSIDADE DE WIDGETS (OBRIGATÓRIO):
Quando pedido análise completa, use VARIEDADE de tipos:
1. Tabela para listar entidades com múltiplas métricas
2. Cards para destaques numéricos importantes
3. Gráficos de linha/área para evolução temporal
4. Gráficos de pizza para distribuição percentual
5. Scatter para correlações
6. Barras apenas quando apropriado para rankings curtos

Exemplo para "analise produtos e vendedores":
✅ BOM: 1 explicacao + 2 cards + 1 tabela produtos + 1 tabela vendedor-produto + 1 linha evolução
❌ RUIM: 1 explicacao + 2 gráficos de barras top 5 sem labels

✅ OBRIGAÇÕES:
✔️ ANALISE os dados agregados em profundidade
✔️ IDENTIFIQUE insights acionáveis e específicos
✔️ ADAPTE completamente a resposta à pergunta do usuário
✔️ USE dados individuais (não apenas rankings) para análises ricas
✔️ VARIE visualizações baseado no QUE você descobriu nos dados

FORMATO DE RESPOSTA OBRIGATÓRIO:
Você DEVE retornar um JSON válido com a seguinte estrutura:

{
  "widgets": [
    {
      "tipo": "explicacao",
      "titulo": "Análise Realizada",
      "dados": {
        "texto": "Descrição clara e específica do que foi analisado"
      }
    },
    // ... 2-4 widgets RELEVANTES para a pergunta específica
  ]
}

TIPOS DE WIDGETS DISPONÍVEIS:

1. explicacao: OBRIGATÓRIO como primeiro widget
   - texto: Descrição clara da análise

2. card: Para métricas/KPIs
   - valor: Valor principal (R$ para monetários)
   - variacao: Percentual (ex: "+15%")
   - subtitulo: Contexto

3. grafico_barras: Comparações verticais
   - labels: Array de NOMES (não códigos)
   - values: Array de valores
   - metadados.formatoMonetario: true

4. grafico_barras_horizontal: Rankings longos (melhor legibilidade)
   - labels: Array de NOMES
   - values: Array de valores
   - metadados.formatoMonetario: true

5. grafico_linha: Evolução temporal
   - labels: Array de datas
   - values: Array de valores
   - metadados.formatoMonetario: true

6. grafico_area: Volume temporal
   - labels: Array de períodos
   - values: Array de valores

7. grafico_pizza: Distribuição (máx 6 fatias)
   - labels: Array de categorias
   - values: Array de valores

8. grafico_donut: Distribuição com centro
   - labels: Array de categorias
   - values: Array de valores

9. grafico_scatter: Correlações
   - pontos: Array de {x, y, nome}
   - labelX: Rótulo X
   - labelY: Rótulo Y

10. grafico_radar: Comparar dimensões
    - labels: Array de dimensões
    - values: Array (0-100)

11. tabela: Dados detalhados
    - colunas: Array de colunas
    - linhas: Array de arrays

12. grafico_barras_linha: Combo (barras + linha)
    - labels: Array de períodos
    - barras: Array de valores
    - linha: Array de valores

13. lista_destaque: Highlights/alertas
    - itens: Array de {titulo, valor, icone?, cor?}
    - cor: "verde" | "vermelho" | "amarelo"

REGRAS:
1. Primeiro widget SEMPRE é "explicacao"
2. SEMPRE retorne JSON válido
3. Use linha/area para dados temporais
4. Use tabela para listas com múltiplas colunas
5. Use pizza/donut para distribuições (máx 6)
6. Use barras_horizontal para rankings longos
7. SEMPRE use NOMES nos labels, NUNCA códigos
8. metadados.formatoMonetario: true para R$
9. Formate cards: "R$ 150.000,00"

⚡ DADOS DISPONÍVEIS (CSV, separador ;):
- PRODUTOS: agregados com totalVendas, quantidadeVendida, ticketMedio
- PARCEIROS: agregados com totalVendas, quantidadeNotas, ticketMedio, recencia
- VENDEDORES: agregados com totalVendas, quantidadeNotas, ticketMedio, clientesAtendidos
- EVOLUÇÃO POR DATA: detalhes de produto/parceiro/vendedor por data (para gráficos temporais)
- VENDEDOR x PRODUTO: cruzamento vendedor-produto
- LEADS: pipeline comercial com funil, estágio, valor, status
- ATIVIDADES: tarefas e atividades do período

⚠️ VOCÊ é o analista: analise os dados CSV e decida quais insights e widgets são relevantes.
SEMPRE use NOMES legíveis nos widgets, NUNCA códigos numéricos.
`;

const PROMPT_ANALISE = `Você é um analista de dados especializado em CRM e vendas.

Sua missão é transformar dados brutos em insights acionáveis através de widgets visuais interativos.

**REGRAS FUNDAMENTAIS:**

1. **SEMPRE complete a análise até o final** - Nunca pare no meio
2. **SEMPRE gere pelo menos 3-5 widgets** relevantes para responder a pergunta
3. **Priorize widgets visuais** (gráficos, tabelas) ao invés de apenas texto
4. **Seja específico e quantitativo** - Use números, percentuais e comparações
5. **Identifique padrões e tendências** - Não apenas liste dados
6. **RESPEITE ESTRITAMENTE O PERÍODO FORNECIDO** - Use apenas as datas especificadas no filtro, nunca invente períodos diferentes
`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, dataInicio, dataFim } = await request.json();

    console.log(`[IA] Nova análise: ${prompt?.substring(0, 50)}... | Período: ${dataInicio} a ${dataFim}`);

    // Obter usuário autenticado (MESMA LÓGICA DO CHAT)
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    let userId = 0;
    let userName = 'Usuário';
    let idEmpresa = 0;

    if (!userCookie) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    userId = user.id;
    userName = user.name || 'Usuário';
    idEmpresa = user.ID_EMPRESA || user.id_empresa || 0;

    // Validar acesso à Análise de Dados
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return NextResponse.json(
          { error: accessControlService.getRestrictedFeatureMessage('Análise de Dados') },
          { status: 403 }
        );
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }

    if (!idEmpresa) {
      return new Response(JSON.stringify({ 
        error: 'Empresa não identificada',
        widgets: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar chave API do Gemini da empresa (configuração por empresa)
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Chave API do Gemini não configurada para esta empresa. Entre em contato com o administrador.',
        widgets: []
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 IA ANÁLISE - INICIALIZAÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Empresa: ${contrato.EMPRESA} (ID: ${idEmpresa})`);
    console.log(`👤 Usuário: ${userName} (ID: ${userId})`);
    console.log(`📅 Período solicitado: ${dataInicio || 'Últimos 30 dias'} até ${dataFim || 'Hoje'}`);

    const genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);
    console.log('✅ IA configurada');

    // Definir período padrão (últimos 30 dias) se não fornecido
    const hoje = new Date();
    const filtro: FiltroAnalise = {
      dataFim: dataFim || hoje.toISOString().split('T')[0],
      dataInicio: dataInicio || new Date(hoje.setDate(hoje.getDate() - 30)).toISOString().split('T')[0],
      idEmpresa // IMPORTANTE: passar idEmpresa no filtro
    };

    console.log(`📅 Período de análise CONFIRMADO: ${filtro.dataInicio} a ${filtro.dataFim}`);
    console.log(`🔄 Buscando dados FRESCOS do banco para o período ${filtro.dataInicio} a ${filtro.dataFim}`);

    // Validar acesso e obter filtros
    const userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);

    console.log('✅ Acesso validado:', {
      role: userAccess.role,
      isAdmin: userAccess.isAdmin,
      codVendedor: userAccess.codVendedor
    });

    // Função para reportar progresso (simulado)
    const reportProgress = (progress: number, message: string) => {
      console.log(`[PROGRESS] ${progress}% - ${message}`);
      // Em um cenário real, você poderia enviar isso via WebSocket ou outra forma de stream
    };

    // Buscar dados do Oracle com filtros de acesso
    reportProgress(10, 'Buscando dados base do Oracle...');
    const dados = await buscarDadosAnalise(
      filtro,
      userId,
      userAccess.isAdmin,
      idEmpresa
    );

    // ====================================
    // BUSCAR DADOS FRESCOS DO SANKHYA (SEM CACHE)
    // ====================================
    console.log('\n🔄 Buscando notas fiscais FRESCAS da Sankhya...');
    console.log(`   📅 Filtro de período: ${filtro.dataInicio} a ${filtro.dataFim}`);
    console.log('   ⚠️ SEM CACHE - Dados diretamente do Sankhya');
    
    const { sankhyaDynamicAPI } = await import('@/lib/sankhya-dynamic-api');

    let cabecalhosNotas: any[] = [];
    let itensNotas: any[] = [];

    try {
      reportProgress(20, 'Buscando cabeçalhos de notas FRESCOS...');
      
      // Buscar CabecalhoNota DIRETO do Sankhya
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
                $: `TIPMOV = 'V' AND DTNEG BETWEEN TO_DATE('${filtro.dataInicio}', 'YYYY-MM-DD') AND TO_DATE('${filtro.dataFim}', 'YYYY-MM-DD')`
              }
            }
          }
        }
      };

      console.log('   🔍 Fazendo requisição DIRETA ao Sankhya...');
      const responseCab = await sankhyaDynamicAPI.fazerRequisicao(
        idEmpresa,
        '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
        'POST',
        payloadCabecalho
      );

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

      console.log(`✅ ${cabecalhosNotas.length} cabeçalhos FRESCOS carregados do Sankhya`);
      console.log(`   📅 Período confirmado: ${filtro.dataInicio} a ${filtro.dataFim}`);

      // Buscar ItemNota em lotes de 1000 (limite do Oracle IN clause)
      if (cabecalhosNotas.length > 0) {
        reportProgress(30, `Buscando itens de ${cabecalhosNotas.length} notas...`);
        const nunotas = cabecalhosNotas.map((c: any) => c.NUNOTA).filter(Boolean);
        const BATCH_SIZE = 1000;
        const totalBatches = Math.ceil(nunotas.length / BATCH_SIZE);

        console.log(`📦 Buscando itens em ${totalBatches} lotes de até ${BATCH_SIZE} NUNOTAs`);

        for (let i = 0; i < totalBatches; i++) {
          const inicio = i * BATCH_SIZE;
          const fim = Math.min(inicio + BATCH_SIZE, nunotas.length);
          const lote = nunotas.slice(inicio, fim);

          console.log(`📤 Lote ${i + 1}/${totalBatches}: ${lote.length} NUNOTAs (${inicio + 1} a ${fim})`);

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
            console.log(`   ✅ ${itensLote.length} itens encontrados neste lote (Total: ${itensNotas.length})`);
          } else {
            console.warn(`   ⚠️ Lote ${i + 1}: Nenhum item retornado`);
          }
        }

        console.log(`✅ TOTAL: ${itensNotas.length} itens de notas carregados de ${nunotas.length} notas`);
      }
    } catch (error: any) {
      console.error('⚠️ Erro ao buscar notas da Sankhya:', error.message);
      reportProgress(35, 'Erro ao buscar notas.');
    }

    // ====================================
    // 2. BUSCAR DADOS DE REFERÊNCIA (CLIENTES, PRODUTOS, VENDEDORES)
    // ====================================
    reportProgress(40, 'Buscando dados de referência (clientes, produtos, vendedores)...');
    console.log('\n📊 Preparando dados de referência...');

    // Coletar CODPARCs únicos de TODAS as fontes
    const codparcsNotas = new Set(cabecalhosNotas.map((n: any) => Number(n.CODPARC)).filter(Boolean));
    const codparcsLeads = new Set(dados.leads.map((l: any) => Number(l.CODPARC)).filter(Boolean));
    const codparcsUnicos = Array.from(new Set([...codparcsNotas, ...codparcsLeads]));

    // Coletar CODPRODs únicos de TODAS as fontes
    const codprodsItens = new Set(itensNotas.map((i: any) => Number(i.CODPROD)).filter(Boolean));
    const codprodsLeads = new Set((dados.produtosLeads || []).map((p: any) => Number(p.CODPROD)).filter(Boolean));
    const codprodsUnicos = Array.from(new Set([...codprodsItens, ...codprodsLeads]));

    // Coletar CODVENDs únicos das Notas
    const codvendsNotas = new Set(cabecalhosNotas.map((n: any) => Number(n.CODVEND)).filter(Boolean));
    const codvendsUnicos = Array.from(codvendsNotas);

    
    let clientesFiltrados: any[] = [];
    let produtosFiltrados: any[] = [];
    let vendedoresFiltrados: any[] = [];

    // Buscar parceiros (clientes)
    if (codparcsUnicos.length > 0) {
      const sqlParceiros = `
        SELECT CODPARC, NOMEPARC, CGC_CPF, RAZAOSOCIAL
        FROM AS_PARCEIROS
        WHERE ID_SISTEMA = :idEmpresa
          AND CODPARC IN (${codparcsUnicos.join(',')})
          AND SANKHYA_ATUAL = 'S'
          AND ATIVO = 'S'
      `;
      clientesFiltrados = await oracleService.executeQuery(sqlParceiros, { idEmpresa });
    }

    // Buscar produtos usando o serviço correto
    if (codprodsUnicos.length > 0) {
      const { buscarProdutosPorCodigos } = await import('@/lib/produtos-service');
      produtosFiltrados = await buscarProdutosPorCodigos(codprodsUnicos);
    }

    // Buscar vendedores (APELIDO é o nome usado)
    if (codvendsUnicos.length > 0) {
      const sqlVendedores = `
        SELECT CODVEND, APELIDO, CODGER, ATIVO
        FROM AS_VENDEDORES
        WHERE ID_SISTEMA = :idEmpresa
          AND CODVEND IN (${codvendsUnicos.join(',')})
          AND SANKHYA_ATUAL = 'S'
          AND ATIVO = 'S'
      `;
      vendedoresFiltrados = await oracleService.executeQuery(sqlVendedores, { idEmpresa });
    }

    // ====================================
    // 3. AGREGAÇÃO AVANÇADA DOS DADOS FRESCOS
    // ====================================
    reportProgress(50, 'Agregando dados...');
    console.log(`[IA] Agregando: ${cabecalhosNotas.length} notas, ${itensNotas.length} itens`);

    const dadosAgregados = await DataAggregationService.agregarDados(
      cabecalhosNotas,
      itensNotas,
      produtosFiltrados,
      clientesFiltrados,
      vendedoresFiltrados,
      (progress, message) => {
        reportProgress(50 + (progress * 0.3), message);
      }
    );

    console.log(`[IA] Agregado: ${dadosAgregados.temporal.porDia.length} dias, R$ ${dadosAgregados.metricas.totalVendas.toLocaleString('pt-BR')}`);

    // Construir contexto CSV completo (mesma estratégia do chat)
    const csvContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 ESTRUTURA DOS DADOS E RELACIONAMENTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 ORIGEM DOS DADOS:
- Funis, Estágios, Leads, Atividades, Produtos dos Leads: Oracle (AS_*)
- Dados Agregados de Vendas: Processados pelo DataAggregationService
- Clientes e Produtos: Oracle - usados como referência para nomes nas agregações

🔗 IMPORTANTE SOBRE AGREGAÇÕES:
- Os dados agregados JÁ CONTÊM OS NOMES (não códigos)
- Cada parceiro/produto/vendedor tem sua própria agregação
- Use os dados agregados como fonte principal de análise
- Use leads/atividades/funis para análise de pipeline

⚠️ CRÍTICO: SEMPRE use NOMES nas respostas, NUNCA códigos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 FUNIS E ESTÁGIOS (${dados.funis.length} funis, ${dados.estagiosFunis.length} estágios)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(dados.funis, null, 2)}

ESTÁGIOS:
${JSON.stringify(dados.estagiosFunis, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 LEADS COMPLETOS (${dados.totalLeads || 0} leads - TODOS OS DADOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify((dados.leads || []).map((l: any) => {
  const estagio = dados.estagiosFunis.find((e: any) => e.CODESTAGIO === l.CODESTAGIO);
  const funil = dados.funis.find((f: any) => f.CODFUNIL === l.CODFUNIL);
  return {
    CODLEAD: l.CODLEAD,
    NOME: l.NOME,
    DESCRICAO: l.DESCRICAO,
    VALOR: l.VALOR || 0,
    STATUS_LEAD: l.STATUS_LEAD || 'EM_ANDAMENTO',
    FUNIL: funil?.NOME || '',
    ESTAGIO: estagio?.NOME || '',
    CLIENTE: l.PARCEIRO_NOME || '',
    DATA_CRIACAO: l.DATA_CRIACAO,
    DATA_VENCIMENTO: l.DATA_VENCIMENTO
  };
}), null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ PRODUTOS NOS LEADS (${dados.produtosLeads?.length || 0} produtos - amostra de 50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify((dados.produtosLeads || []).slice(0, 50), null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ PRODUTOS NOS LEADS (${dados.produtosLeads?.length || 0} produtos - TODOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify((dados.produtosLeads || []).map((p: any) => {
  const produto = produtosFiltrados.find(prod => prod.CODPROD === p.CODPROD);
  return {
    CODLEAD: p.CODLEAD,
    PRODUTO: produto?.DESCRPROD || `Produto ${p.CODPROD}`,
    QUANTIDADE: p.QUANTIDADE,
    VLRUNIT: p.VLRUNIT,
    VLRTOTAL: p.VLRTOTAL
  };
}), null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ATIVIDADES COMPLETAS (${dados.totalAtividades || 0} atividades - TODAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify((dados.atividades || []).map((a: any) => ({
  CODATIVIDADE: a.CODATIVIDADE,
  CODLEAD: a.CODLEAD,
  TIPO: a.TIPO,
  TITULO: a.TITULO || (a.DESCRICAO?.split('|')[0] || a.DESCRICAO || 'Sem título'),
  DESCRICAO: a.DESCRICAO,
  STATUS: a.STATUS || 'AGUARDANDO',
  DATA_INICIO: a.DATA_INICIO,
  DATA_FIM: a.DATA_FIM
})), null, 2)}
`;

    // Montar contexto detalhado para a IA
    const contexto = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONTEXTO COMPLETO PARA ANÁLISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ PERÍODO DE ANÁLISE OBRIGATÓRIO: ${filtro.dataInicio} até ${filtro.dataFim}
⚠️ VOCÊ DEVE ANALISAR APENAS ESTE PERÍODO ESPECÍFICO
⚠️ NÃO mencione "últimos 6 meses" ou qualquer outro período diferente

MÉTRICAS GERAIS DO PERÍODO (${filtro.dataInicio} a ${filtro.dataFim}):
- Total de Leads: ${dados.totalLeads}
- Total de Atividades: ${dados.totalAtividades}
- Total de Pedidos: ${dados.totalPedidos}
- Total de Clientes: ${dados.totalClientes}
- Valor Total de Pedidos: R$ ${dados.valorTotalPedidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Ticket Médio: R$ ${(dados.valorTotalPedidos / (dados.totalPedidos || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
`;

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
      : 'Sem dados de produtos';

    // Agregar vendas por parceiro (consolidado do período)
    const parceirosCSV = dadosAgregados?.porParceiro?.length > 0
      ? toCSV(dadosAgregados.porParceiro.slice(0, 100), ['NOMEPARC', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'recencia'])
      : 'Sem dados de parceiros';

    // Agregar vendas por vendedor (consolidado do período)
    const vendedoresCSV = dadosAgregados?.porVendedor?.length > 0
      ? toCSV(dadosAgregados.porVendedor, ['NOMEVENDEDOR', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'clientesUnicos'])
      : 'Sem dados de vendedores';

    // Temporal por dia (compacto - só totais) - ORDENAR por data
    const diasOrdenados = dadosAgregados?.temporal?.porDia?.length > 0
      ? [...dadosAgregados.temporal.porDia].sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
      : [];
    const temporalDiaCSV = diasOrdenados.length > 0
      ? toCSV(diasOrdenados, ['data', 'totalVendas', 'quantidadeNotas', 'ticketMedio', 'clientesUnicos', 'produtosUnicos'])
      : 'Sem dados temporais';

    // Detalhes por data-produto (para análise de evolução de cada produto) - USAR DIAS ORDENADOS
    const detalheProdutoPorData: any[] = [];
    diasOrdenados.forEach((dia: any) => {
      (dia.detalhesProdutos || []).forEach((p: any) => {
        detalheProdutoPorData.push({ data: dia.data, nome: p.nome, total: p.total, qtd: p.qtd, media: p.media });
      });
    });
    const produtoPorDataCSV = detalheProdutoPorData.length > 0 ? toCSV(detalheProdutoPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

    // Detalhes por data-parceiro - USAR DIAS ORDENADOS
    const detalheParceiroPorData: any[] = [];
    diasOrdenados.forEach((dia: any) => {
      (dia.detalhesParceiros || []).forEach((p: any) => {
        detalheParceiroPorData.push({ data: dia.data, nome: p.nome, total: p.total, qtd: p.qtd, media: p.media });
      });
    });
    const parceiroPorDataCSV = detalheParceiroPorData.length > 0 ? toCSV(detalheParceiroPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

    // Detalhes por data-vendedor - USAR DIAS ORDENADOS
    const detalheVendedorPorData: any[] = [];
    diasOrdenados.forEach((dia: any) => {
      (dia.detalhesVendedores || []).forEach((v: any) => {
        detalheVendedorPorData.push({ data: dia.data, nome: v.nome, total: v.total, qtd: v.qtd, media: v.media });
      });
    });
    const vendedorPorDataCSV = detalheVendedorPorData.length > 0 ? toCSV(detalheVendedorPorData, ['data', 'nome', 'total', 'qtd', 'media']) : 'Sem dados';

    // Vendedor x Produto (qual vendedor vendeu quais produtos)
    const vendedorProdutoFlatList: any[] = [];
    (dadosAgregados?.vendedorProduto || []).forEach((v: any) => {
      (v.produtos || []).forEach((p: any) => { 
        vendedorProdutoFlatList.push({
          NOMEVENDEDOR: v.NOMEVENDEDOR,
          NOMEPRODUTO: p.DESCRPROD,
          valorTotal: p.valorTotal,
          qtdVendida: p.quantidadeVendida,
          clientesUnicos: p.clientesUnicos
        });
      });
    });
    const vendedorProdutoCSV = vendedorProdutoFlatList.length > 0
      ? toCSV(vendedorProdutoFlatList, ['NOMEVENDEDOR', 'NOMEPRODUTO', 'valorTotal', 'qtdVendida', 'clientesUnicos'])
      : 'Sem dados vendedor-produto';

    // Leads em CSV
    const leadsCSV = (dados.leads || []).length > 0
      ? toCSV(dados.leads.map((l: any) => ({
          NOME: l.NOME,
          VALOR: l.VALOR || 0,
          STATUS: l.STATUS_LEAD || 'EM_ANDAMENTO',
          FUNIL: l.FUNIL_NOME || '',
          ESTAGIO: l.ESTAGIO_NOME || '',
          CLIENTE: l.PARCEIRO_NOME || ''
        })), ['NOME', 'VALOR', 'STATUS', 'FUNIL', 'ESTAGIO', 'CLIENTE'])
      : 'Sem leads';

    // Atividades em CSV
    const atividadesCSV = (dados.atividades || []).length > 0
      ? toCSV(dados.atividades.map((a: any) => ({
          TIPO: a.TIPO,
          TITULO: a.TITULO || a.DESCRICAO?.split('|')[0] || 'Sem título',
          STATUS: a.STATUS || 'PENDENTE',
          DATA: a.DATA_INICIO
        })), ['TIPO', 'TITULO', 'STATUS', 'DATA'])
      : 'Sem atividades';

    const DADOS_DISPONIVEIS = `
⚡ DADOS BRUTOS DO PERÍODO ${filtro.dataInicio} a ${filtro.dataFim} (CSV, separador: ;)
Analise estes dados e descubra insights, padrões e tendências.

📊 RESUMO: ${dadosAgregados?.metricas?.totalNotas || 0} notas | R$ ${dadosAgregados?.metricas?.totalVendas?.toLocaleString('pt-BR') || 0} total | Ticket R$ ${dadosAgregados?.metricas?.ticketMedio?.toLocaleString('pt-BR') || 0}

📦 PRODUTOS (${dadosAgregados?.porProduto?.length || 0}):
${produtosCSV}

👥 PARCEIROS (${dadosAgregados?.porParceiro?.length || 0}):
${parceirosCSV}

👤 VENDEDORES (${dadosAgregados?.porVendedor?.length || 0}):
${vendedoresCSV}

📅 VENDAS POR DIA:
${temporalDiaCSV}

📈 EVOLUÇÃO PRODUTO/DATA:
${produtoPorDataCSV}

📈 EVOLUÇÃO PARCEIRO/DATA:
${parceiroPorDataCSV}

📈 EVOLUÇÃO VENDEDOR/DATA:
${vendedorPorDataCSV}

🔗 VENDEDOR x PRODUTO:
${vendedorProdutoCSV}

💼 LEADS (${(dados.leads || []).length}):
${leadsCSV}

📝 ATIVIDADES (${(dados.atividades || []).length}):
${atividadesCSV}

🎯 FUNIS: ${dados.funis?.map((f: any) => f.NOME).join(', ') || 'Nenhum'}
`;

    // Calcular quantidade de dias/meses no período
    const dataInicioDate = new Date(filtro.dataInicio);
    const dataFimDate = new Date(filtro.dataFim);
    const diasNoPeriodo = Math.ceil((dataFimDate.getTime() - dataInicioDate.getTime()) / (1000 * 60 * 60 * 24));
    const mesesNoPeriodo = Math.ceil(diasNoPeriodo / 30);

    // Montar prompt final com validação rigorosa de período
    const promptFinal = `${contexto}

${DADOS_DISPONIVEIS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ VALIDAÇÃO RIGOROSA DO PERÍODO DE ANÁLISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 PERÍODO OBRIGATÓRIO: ${filtro.dataInicio} até ${filtro.dataFim}
📊 DIAS NO PERÍODO: ${diasNoPeriodo} dias
📆 MESES NO PERÍODO: ${mesesNoPeriodo} mês(es)

🚫 REGRAS ABSOLUTAS:
1. Você DEVE analisar APENAS os dados de ${filtro.dataInicio} até ${filtro.dataFim}
2. Se o período for menor que 60 dias, NÃO faça análises mensais - os dados são insuficientes
3. Se o período for de 1 mês, mencione "análise do mês de [mês/ano]" e NÃO "análise mensal"
4. NUNCA mencione "últimos X meses" se o período filtrado for diferente
5. O primeiro widget DEVE iniciar com: "Análise do período de ${filtro.dataInicio} a ${filtro.dataFim}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ PERGUNTA DO USUÁRIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${prompt}

⚠️ IMPORTANTE: 
- Período: ${filtro.dataInicio} a ${filtro.dataFim} (${diasNoPeriodo} dias)
- Se há ${mesesNoPeriodo} mês(es) de dados, seja explícito sobre isso
- NÃO use termos genéricos como "análise mensal" se há apenas 1 mês
- Use "análise do período" ou "análise de [mês específico]"`;

    console.log(`[IA] Contexto: ~${Math.ceil(promptFinal.length / 4)} tokens | Período: ${filtro.dataInicio} a ${filtro.dataFim}`);

    // Instanciar modelo Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    // Chamar IA
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: PROMPT_ANALISE }],
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido! Vou analisar os dados e gerar widgets visuais completos e relevantes, respeitando estritamente o período de análise fornecido.' }],
        }
      ]
    });

    reportProgress(85, 'Gerando análise com Gemini...');

    const finalInstruction = `
TAREFA: Analise os dados CSV e responda: "${prompt}"

🚨 REGRAS:
1. Use NOMES (NOMEPRODUTO, NOMEPARCEIRO, NOMEVENDEDOR), NUNCA códigos
2. Analise padrões, tendências e insights nos dados - não apenas liste
3. Escolha os widgets mais adequados para visualizar sua análise
4. Diversifique tipos de widgets (tabelas, gráficos linha, pizza, scatter, cards)
5. Gere 3-6 widgets relevantes para a pergunta

Retorne JSON válido com widgets baseados nos dados CSV acima.
`;

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: promptFinal },
      { text: finalInstruction }
    ]);

    const responseText = result.response.text();

    // Extrair JSON da resposta (remover markdown se houver)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsedResponse = JSON.parse(jsonText);

    reportProgress(100, 'Análise concluída!');
    console.log('\n✅ ANÁLISE CONCLUÍDA');
    console.log(`   📊 ${parsedResponse.widgets?.length || 0} widgets gerados`);
    console.log(`   ⏱️  Tempo total: ~${Math.round((Date.now() - Date.now()) / 1000)}s`);

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌ Erro na análise Gemini:', error.message);
    return new Response(JSON.stringify({ 
      error: `Erro ao processar análise: ${error.message}`,
      widgets: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
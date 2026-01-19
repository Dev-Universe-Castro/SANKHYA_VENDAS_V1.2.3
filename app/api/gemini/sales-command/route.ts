import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { oracleService } from '@/lib/oracle-db';
import { contratosService } from '@/lib/contratos-service';
import { sankhyaDynamicAPI } from '@/lib/sankhya-dynamic-api';

const SYSTEM_PROMPT = `Você é um Assistente de Vendas especializado em gerar insights acionáveis para acelerar vendas.

🎯 SUA MISSÃO:
Analisar dados de vendas, produtos e leads para gerar 3 tipos de insights práticos e imediatos:

1. **FOQUE NISSO HOJE** (3 cards de alerta):
   - Oportunidades quentes (leads parados com alto valor)
   - Foco operacional (propostas sem retorno há 48h+)
   - Leads de alto valor sem atividade recente

2. **MIX DE VENDA RÁPIDA** (produtos estratégicos):
   - NOVO: Produtos do catálogo NUNCA comprados pelo cliente
   - EXPANSÃO: Produtos comprados há 60+ dias (recompra)
   - RECORRENTE: Produtos com padrão de compra mensal

3. **TIMELINE INTELIGENTE** (próximas ações):
   - Follow-ups prioritários baseados em tempo de inatividade
   - Demonstrações de produto para leads avançados
   - Visitas estratégicas baseadas em histórico

📊 DADOS DISPONÍVEIS:
- Produtos: Catálogo completo (do IndexedDB via prefetch)
- Parceiros: Base de clientes (do IndexedDB via prefetch)
- Leads: Pipeline de vendas com estágios (Oracle)
- Pedidos: Últimos 30 dias de faturamento (Sankhya API)
- Itens de Pedidos: Detalhamento de produtos vendidos (Sankhya API)

🔧 FORMATO DE RESPOSTA OBRIGATÓRIO:

{
  "kpis": {
    "totalVendas": "R$ 150.000,00",
    "variacaoVendas": "+15%" ou "-5%" (opcional),
    "ticketMedio": "R$ 5.000,00",
    "totalPedidos": "30",
    "produtosUnicos": "45"
  },
  "foqueNissoHoje": [
    {
      "tipo": "oportunidade" | "risco" | "meta",
      "titulo": "Título curto e impactante",
      "descricao": "Explicação objetiva com dados concretos",
      "valor": "R$ 50.000" (se aplicável),
      "acao": "Texto do botão de ação",
      "acaoUrl": "/dashboard/leads?leadId=123" (link direto),
      "prioridade": "alta" | "media" | "baixa",
      "dados": { objeto com dados estruturados para ação }
    }
  ],
  "mixVendaRapida": [
    {
      "codProd": "1001",
      "descricao": "Nome do produto",
      "tipo": "novo" | "expansao" | "recorrente",
      "ultimaCompra": "DD/MM/YYYY" (se aplicável),
      "potencial": 85 (score de 0-100),
      "motivo": "Explicação do porquê está na lista"
    }
  ],
  "timelineInteligente": [
    {
      "tipo": "follow-up" | "demonstracao" | "visita" | "proposta",
      "titulo": "Ação prioritária",
      "descricao": "Contexto e próximos passos",
      "prioridade": "alta" | "media" | "baixa",
      "leadId": "123" (se aplicável),
      "parceiroId": "456" (se aplicável),
      "prazo": "hoje" | "amanha" | "esta-semana",
      "icone": "phone" | "presentation" | "map-pin" | "file-text"
    }
  ],
  "widgets": [
    {
      "tipo": "grafico_barras" | "grafico_linha" | "grafico_pizza" | "tabela" | "card",
      "titulo": "Top 5 Produtos Mais Vendidos",
      "dados": {
        "labels": ["Produto A", "Produto B", ...],
        "values": [1500, 1200, ...]
      },
      "metadados": {
        "formatoMonetario": true
      }
    }
  ]
}

⚠️ REGRAS CRÍTICAS:
- Use APENAS dados reais fornecidos - NUNCA invente
- Priorize insights que geram AÇÃO IMEDIATA
- Seja específico: nomes reais, valores reais, datas reais
- Limite a 3 itens por seção para não sobrecarregar
- Ordene por urgência/impacto (maior primeiro)
- Inclua SEMPRE dados estruturados para permitir ação direta`;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || user.id_empresa || 0;

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    // Validar acesso
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return NextResponse.json(
          { error: accessControlService.getRestrictedFeatureMessage('Sales Command Center') },
          { status: 403 }
        );
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }

    // Buscar contrato e chave Gemini
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'Chave API do Gemini não configurada para esta empresa.' 
      }, { status: 403 });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 SALES COMMAND CENTER - INICIALIZAÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Empresa: ${contrato.EMPRESA} (ID: ${idEmpresa})`);
    console.log(`👤 Usuário: ${user.name} (ID: ${user.id})`);

    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    const dataInicio30Dias = new Date(hoje.setDate(hoje.getDate() - 30)).toISOString().split('T')[0];

    // ========== ETAPA 1: BUSCAR DADOS DO ORACLE (Leads e Atividades) ==========
    console.log('\n📦 Buscando dados do Oracle (Leads e Atividades)...');

    // Leads ativos
    const sqlLeads = `
      SELECT 
        CODLEAD, NOME, VALOR, STATUS_LEAD, CODPARC,
        TO_CHAR(DATA_ATUALIZACAO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO,
        TO_CHAR(DATA_CRIACAO, 'DD/MM/YYYY') AS DATA_CRIACAO
      FROM AD_LEADS 
      WHERE ID_EMPRESA = :idEmpresa 
        AND ATIVO = 'S'
        AND STATUS_LEAD = 'EM_ANDAMENTO'
      ORDER BY DATA_ATUALIZACAO DESC
      FETCH FIRST 100 ROWS ONLY
    `;
    const leads = await oracleService.executeQuery(sqlLeads, { idEmpresa });
    console.log(`✅ ${leads.length} leads ativos carregados do Oracle`);

    // Atividades dos leads (para insights priorizados)
    const sqlAtividades = `
      SELECT 
        CODATIVIDADE, CODLEAD, TIPO, TITULO, DESCRICAO,
        TO_CHAR(DATA_INICIO, 'DD/MM/YYYY') AS DATA_INICIO,
        STATUS, CODUSUARIO
      FROM AD_ADLEADSATIVIDADES
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
        AND STATUS IN ('AGUARDANDO', 'ATRASADO')
      ORDER BY DATA_INICIO ASC
      FETCH FIRST 100 ROWS ONLY
    `;
    const atividades = await oracleService.executeQuery(sqlAtividades, { idEmpresa });
    console.log(`✅ ${atividades.length} atividades pendentes carregadas do Oracle`);

    // ========== ETAPA 2: BUSCAR DADOS DA SANKHYA (CabecalhoNota e ItemNota via API) ==========
    console.log('\n🔄 Buscando dados transacionais da Sankhya (últimos 30 dias)...');

    // Buscar Cabeçalhos de Notas (últimos 30 dias) via loadRecords
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
              list: 'NUNOTA,DTNEG,CODPARC,VLRNOTA'
            }
          },
          criteria: {
            expression: {
              $: `DTNEG BETWEEN TO_DATE('${dataInicio30Dias}', 'YYYY-MM-DD') AND TO_DATE('${dataFim}', 'YYYY-MM-DD')`
            }
          }
        }
      }
    };

    console.log('📤 Payload loadRecords (CabecalhoNota):');
    console.log(JSON.stringify(payloadCabecalho, null, 2));

    let cabecalhos: any[] = [];
    try {
      const responseCab = await sankhyaDynamicAPI.fazerRequisicao(
        idEmpresa,
        '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
        'POST',
        payloadCabecalho
      );

      console.log('📦 Resposta CabecalhoNota (raw):', JSON.stringify(responseCab?.responseBody?.entities, null, 2));

      // Processar resposta do loadRecords conforme formato da API
      const entities = responseCab?.responseBody?.entities;
      if (entities?.entity) {
        const fieldNames = entities.metadata?.fields?.field?.map((f: any) => f.name) || [];
        
        // A resposta pode ser um array ou um objeto único
        const entityArray = Array.isArray(entities.entity) ? entities.entity : [entities.entity];

        cabecalhos = entityArray.map((rawEntity: any) => {
          const cleanObject: any = {};
          
          // Mapear f0, f1, f2, f3... para NUNOTA, DTNEG, CODPARC, VLRNOTA
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

      console.log(`✅ ${cabecalhos.length} cabeçalhos de nota carregados da Sankhya`);
    } catch (error: any) {
      console.error('⚠️ Erro ao buscar cabeçalhos da Sankhya:', error.message);
    }

    // Buscar Itens de Notas (casamento com cabeçalhos)
    const nunotas = cabecalhos.map((c: any) => c.NUNOTA).filter(Boolean).slice(0, 100);
    let itens: any[] = [];

    if (nunotas.length > 0) {
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
                list: 'NUNOTA,CODPROD,CODVOL,QTDNEG,VLRUNIT,VLRTOT'
              }
            },
            criteria: {
              expression: {
                $: `NUNOTA IN (${nunotas.join(',')})`
              }
            }
          }
        }
      };

      console.log('📤 Payload loadRecords (ItemNota):');
      console.log(JSON.stringify(payloadItens, null, 2));

      try {
        const responseItens = await sankhyaDynamicAPI.fazerRequisicao(
          idEmpresa,
          '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
          'POST',
          payloadItens
        );

        console.log('📦 Resposta ItemNota (raw):', JSON.stringify(responseItens?.responseBody?.entities, null, 2));

        // Processar resposta do loadRecords conforme formato da API
        const entities = responseItens?.responseBody?.entities;
        if (entities?.entity) {
          const fieldNames = entities.metadata?.fields?.field?.map((f: any) => f.name) || [];
          
          // A resposta pode ser um array ou um objeto único
          const entityArray = Array.isArray(entities.entity) ? entities.entity : [entities.entity];

          itens = entityArray.map((rawEntity: any) => {
            const cleanObject: any = {};
            
            // Mapear f0, f1, f2... para NUNOTA, CODPROD, CODVOL, QTDNEG, VLRUNIT, VLRTOT, SEQUENCIA
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

        console.log(`✅ ${itens.length} itens de nota carregados da Sankhya`);
      } catch (error: any) {
        console.error('⚠️ Erro ao buscar itens da Sankhya:', error.message);
      }
    }

    // ========== ETAPA 3: RECEBER DADOS DO PREFETCH (Produtos e Parceiros do IndexedDB) ==========
    console.log('\n💾 Recebendo dados do prefetch (IndexedDB)...');

    let produtos: any[] = [];
    let parceiros: any[] = [];

    try {
      const bodyText = await request.text();
      console.log('📦 Tamanho do body recebido:', bodyText.length, 'bytes');

      if (!bodyText.trim()) {
        throw new Error('Body vazio - produtos e parceiros são obrigatórios do IndexedDB');
      }

      const body = JSON.parse(bodyText);
      produtos = body.produtos || [];
      parceiros = body.parceiros || [];

      if (produtos.length === 0) {
        console.warn('⚠️ Nenhum produto foi enviado do IndexedDB');
      } else {
        console.log(`✅ ${produtos.length} produtos recebidos do IndexedDB`);
      }

      if (parceiros.length === 0) {
        console.warn('⚠️ Nenhum parceiro foi enviado do IndexedDB');
      } else {
        console.log(`✅ ${parceiros.length} parceiros recebidos do IndexedDB`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao processar dados do IndexedDB:', error.message);
      return NextResponse.json({ 
        error: 'Produtos e parceiros devem ser enviados do IndexedDB',
        message: error.message 
      }, { status: 400 });
    }

    // ========== ETAPA 4: CONSTRUIR CONTEXTO PARA O GEMINI ==========
    console.log('\n🧠 Preparando contexto para o Gemini...');

    // LIMITAR DADOS PARA EVITAR OVERFLOW DO GEMINI
    const maxProdutos = 50;
    const maxParceiros = 30;
    const maxLeads = 50;
    const maxAtividades = 30;
    const maxCabecalhos = 50;
    const maxItens = 100;

    const contextoCsv = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUTOS DO CATÁLOGO (${produtos.length} produtos - mostrando ${Math.min(produtos.length, maxProdutos)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODPROD,DESCRPROD
${produtos.slice(0, maxProdutos).map((p: any) => `${p.CODPROD},"${(p.DESCRPROD || '').substring(0, 50)}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 PARCEIROS/CLIENTES (${parceiros.length} cadastrados - mostrando ${Math.min(parceiros.length, maxParceiros)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODPARC,NOMEPARC
${parceiros.slice(0, maxParceiros).map((p: any) => `${p.CODPARC},"${(p.NOMEPARC || '').substring(0, 50)}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 LEADS ATIVOS (${leads.length} no pipeline - mostrando ${Math.min(leads.length, maxLeads)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODLEAD,NOME,VALOR,CODPARC,DATA_CRIACAO,DATA_ATUALIZACAO
${leads.slice(0, maxLeads).map((l: any) => `${l.CODLEAD},"${(l.NOME || '').substring(0, 50)}",${l.VALOR},${l.CODPARC || ''},"${l.DATA_CRIACAO}","${l.DATA_ATUALIZACAO}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ATIVIDADES PENDENTES (${atividades.length} atividades - mostrando ${Math.min(atividades.length, maxAtividades)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODATIVIDADE,CODLEAD,TIPO,TITULO,DATA_INICIO,STATUS
${atividades.slice(0, maxAtividades).map((a: any) => `${a.CODATIVIDADE},${a.CODLEAD},"${a.TIPO}","${(a.TITULO || '').substring(0, 50)}","${a.DATA_INICIO}","${a.STATUS}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 PEDIDOS RECENTES (${cabecalhos.length} notas - mostrando ${Math.min(cabecalhos.length, maxCabecalhos)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUNOTA,DTNEG,CODPARC,VLRNOTA
${cabecalhos.slice(0, maxCabecalhos).map((c: any) => `${c.NUNOTA},"${c.DTNEG}",${c.CODPARC},${c.VLRNOTA}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ITENS DOS PEDIDOS (${itens.length} itens - mostrando ${Math.min(itens.length, maxItens)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUNOTA,CODPROD,CODVOL,QTDNEG,VLRUNIT,VLRTOT
${itens.slice(0, maxItens).map((i: any) => `${i.NUNOTA},${i.CODPROD},"${i.CODVOL || 'UN'}",${i.QTDNEG},${i.VLRUNIT},${i.VLRTOT}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ANÁLISE REQUERIDA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE: Use as tabelas para cruzar dados:
- CODPROD da tabela ITENS DOS PEDIDOS → PRODUTOS DO CATÁLOGO para obter nome do produto
- CODPARC da tabela PEDIDOS RECENTES → PARCEIROS/CLIENTES para obter nome do cliente
- CODLEAD da tabela ATIVIDADES PENDENTES → LEADS ATIVOS para vincular atividades a leads

Com base nos dados acima, gere insights acionáveis em 5 categorias:

1. KPIS DE PERFORMANCE (4 cards obrigatórios):
   {
     "totalVendas": "R$ X.XXX,XX" (SUM de VLRNOTA dos últimos 30 dias),
     "variacaoVendas": "+X%" ou "-X%" (comparar com período anterior se houver dados),
     "ticketMedio": "R$ X.XXX,XX" (AVG de VLRNOTA),
     "totalPedidos": "XXX" (COUNT de NUNOTA),
     "produtosUnicos": "XXX" (COUNT DISTINCT de CODPROD em itens)
   }

2. FOQUE NISSO HOJE (3 cards): Use LEADS ATIVOS + ATIVIDADES PENDENTES
   - Leads de alto valor sem atualização recente (compare DATA_ATUALIZACAO com hoje)
   - Atividades atrasadas (STATUS = 'ATRASADO') de leads importantes
   - Leads com valor alto sem atividades recentes

3. MIX DE VENDA RÁPIDA (5-7 produtos): Use PRODUTOS DO CATÁLOGO + ITENS DOS PEDIDOS
   - NOVO: Produtos no catálogo que NÃO aparecem em ITENS DOS PEDIDOS
   - EXPANSÃO: Produtos que aparecem nos ITENS mas com baixa frequência
   - RECORRENTE: Produtos que aparecem em múltiplas notas (cruze por NUNOTA)

   Para cada produto, use CODPROD para buscar DESCRPROD na tabela de PRODUTOS

4. TIMELINE INTELIGENTE (3-5 ações): Use ATIVIDADES PENDENTES prioritariamente
   - Priorize atividades com STATUS = 'ATRASADO'
   - Follow-ups baseados em DATA_INICIO das atividades
   - Demonstrações (TIPO = 'DEMONSTRACAO' ou similar)

   Para cada atividade, use CODLEAD para buscar o nome do lead em LEADS ATIVOS

5. WIDGETS DE ANÁLISE DINÂMICA (3-5 widgets):
   Crie widgets de análise visual usando o formato do WidgetRenderer:
   
   WIDGETS OBRIGATÓRIOS:
   a) Top 5 Produtos Mais Vendidos (grafico_barras):
      - Agrupe por CODPROD e some QTDNEG ou VLRTOT
      - Busque DESCRPROD na tabela de produtos
      - labels: nomes dos produtos
      - values: quantidades ou valores
   
   b) Top 5 Clientes (grafico_pizza):
      - Agrupe por CODPARC e some VLRNOTA
      - Busque NOMEPARC na tabela de parceiros
      - labels: nomes dos clientes
      - values: valores totais
   
   c) Evolução de Vendas (grafico_linha):
      - Agrupe por DTNEG (por dia ou semana)
      - Some VLRNOTA por período
      - labels: datas
      - values: valores totais
      - metadados: { formatoMonetario: true }
   
   WIDGETS OPCIONAIS (escolha 1-2):
   d) Mix de Produtos por Cliente (tabela):
      - Mostre produtos comprados por cada top cliente
      - colunas: ["Cliente", "Produto", "Quantidade", "Valor Total"]
   
   e) Análise de Ticket Médio (card):
      - Calcule ticket médio por cliente ou período
      - valor: ticket médio
      - variacao: comparação com período anterior
   
   FORMATO DOS WIDGETS:
   {
     "tipo": "grafico_barras" | "grafico_linha" | "grafico_pizza" | "tabela" | "card",
     "titulo": "Título do Widget",
     "dados": {
       "labels": ["Label1", "Label2", ...],
       "values": [100, 200, ...]
     },
     "metadados": {
       "formatoMonetario": true // se aplicável
     }
   }

Seja ESPECÍFICO com nomes, códigos e valores REAIS dos dados fornecidos.
`;

    const contextPrompt = `${contextoCsv}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ INSTRUÇÕES CRÍTICAS DE FORMATAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Retorne APENAS o JSON estruturado completo
2. NÃO adicione texto antes ou depois do JSON
3. NÃO use markdown code blocks (\`\`\`json)
4. GARANTA que o JSON esteja COMPLETO com todas as 5 seções:
   - kpis (obrigatório)
   - foqueNissoHoje (pode ser array vazio [])
   - mixVendaRapida (pode ser array vazio [])
   - timelineInteligente (pode ser array vazio [])
   - widgets (pode ser array vazio [])

5. Use valores compactos e objetivos
6. Limite cada array a no máximo 5 itens
7. O JSON deve ser válido e parseável

COMECE SUA RESPOSTA DIRETAMENTE COM { e TERMINE COM }
`;

    // ========== ETAPA 5: CHAMAR GEMINI ==========
    console.log('\n🤖 Enviando para Gemini 2.5 Flash...');

    const genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // Reduzir temperatura para respostas mais consistentes
        maxOutputTokens: 8192, // Aumentar limite para garantir resposta completa
        responseMimeType: "application/json", // Forçar resposta em JSON
      }
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: contextPrompt }
    ]);

    const responseText = result.response.text();
    console.log('📝 Resposta completa do Gemini:', responseText.length, 'caracteres');
    console.log('📝 Primeiros 1000 caracteres:', responseText.substring(0, 1000));
    console.log('📝 Últimos 1000 caracteres:', responseText.substring(Math.max(0, responseText.length - 1000)));

    // Extrair JSON da resposta de forma mais robusta
    let jsonText = responseText.trim();
    
    // Remover markdown code blocks se existirem
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/g, '').replace(/```\s*$/g, '');
    }

    // NÃO truncar - usar o texto completo
    jsonText = jsonText.trim();

    console.log('🔍 JSON completo extraído:', jsonText.length, 'caracteres');

    let insights;
    try {
      insights = JSON.parse(jsonText);
      
      // Validar se contém as seções obrigatórias
      if (!insights.kpis || !insights.foqueNissoHoje || !insights.mixVendaRapida || !insights.timelineInteligente) {
        console.warn('⚠️ JSON incompleto - faltam seções obrigatórias');
        throw new Error('JSON incompleto retornado pelo Gemini');
      }
      
    } catch (parseError: any) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError.message);
      console.error('📄 Tamanho do JSON:', jsonText.length);
      console.error('📄 Primeiros 2000 caracteres:', jsonText.substring(0, 2000));
      console.error('📄 Últimos 2000 caracteres:', jsonText.substring(Math.max(0, jsonText.length - 2000)));
      
      // Fallback com estrutura básica
      insights = {
        kpis: {
          totalVendas: "R$ 0,00",
          ticketMedio: "R$ 0,00",
          totalPedidos: "0",
          produtosUnicos: "0"
        },
        foqueNissoHoje: [],
        mixVendaRapida: [],
        timelineInteligente: [],
        widgets: []
      };
      
      console.warn('⚠️ Usando fallback devido a erro no parse');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SALES COMMAND CENTER - INSIGHTS GERADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Foque Nisso Hoje: ${insights.foqueNissoHoje?.length || 0} cards`);
    console.log(`   Mix de Venda: ${insights.mixVendaRapida?.length || 0} produtos`);
    console.log(`   Timeline: ${insights.timelineInteligente?.length || 0} ações`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json(insights);

  } catch (error: any) {
    console.error('❌ Erro no Sales Command Center:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar insights',
      message: error.message 
    }, { status: 500 });
  }
}
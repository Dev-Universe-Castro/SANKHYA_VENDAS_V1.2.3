import { oracleService } from './oracle-db';

export interface Lead {
  CODLEAD: string
  ID_EMPRESA: number
  NOME: string
  DESCRICAO: string
  VALOR: number
  ESTAGIO: string
  CODESTAGIO: string
  CODFUNIL: string
  DATA_VENCIMENTO: string
  TIPO_TAG: string
  COR_TAG: string
  CODPARC?: string
  CODUSUARIO?: number
  ATIVO: string
  DATA_CRIACAO: string
  DATA_ATUALIZACAO: string
  STATUS_LEAD?: 'EM_ANDAMENTO' | 'GANHO' | 'PERDIDO'
  MOTIVO_PERDA?: string
  DATA_CONCLUSAO?: string
}

export interface LeadProduto {
  CODITEM?: string
  CODLEAD: string
  ID_EMPRESA: number
  CODPROD: number
  DESCRPROD: string
  QUANTIDADE: number
  VLRUNIT: number
  VLRTOTAL: number
  ATIVO?: string
  DATA_INCLUSAO?: string
}

export interface LeadAtividade {
  CODATIVIDADE: string
  CODLEAD: string
  ID_EMPRESA: number
  TIPO: 'LIGACAO' | 'EMAIL' | 'REUNIAO' | 'VISITA' | 'PEDIDO' | 'CLIENTE' | 'NOTA' | 'WHATSAPP' | 'PROPOSTA'
  TITULO: string
  DESCRICAO: string
  DATA_HORA: string
  DATA_INICIO: string
  DATA_FIM: string
  CODUSUARIO: number
  DADOS_COMPLEMENTARES?: string
  NOME_USUARIO?: string
  COR?: string
  ORDEM?: number
  ATIVO?: string
  STATUS?: 'AGUARDANDO' | 'ATRASADO' | 'REALIZADO'
}

// ==================== LEADS ====================

export async function consultarLeads(
  idEmpresa: number, 
  codUsuario?: number, 
  isAdmin: boolean = false,
  dataInicio?: string,
  dataFim?: string,
  codVendedor?: number,
  vendedoresEquipe?: number[],
  codFunil?: string,
  codParc?: string
): Promise<Lead[]> {
  console.log('🔍 [Oracle] Consultando leads:', { idEmpresa, codUsuario, isAdmin, dataInicio, dataFim, codVendedor, vendedoresEquipe, codFunil, codParc });

  try {
    let sql = `
      SELECT 
        TO_CHAR(CODLEAD) AS CODLEAD,
        ID_EMPRESA,
        NOME,
        DESCRICAO,
        VALOR,
        TO_CHAR(CODESTAGIO) AS CODESTAGIO,
        TO_CHAR(CODFUNIL) AS CODFUNIL,
        TO_CHAR(DATA_VENCIMENTO, 'DD/MM/YYYY') AS DATA_VENCIMENTO,
        TIPO_TAG,
        COR_TAG,
        CODPARC,
        CODUSUARIO,
        ATIVO,
        TO_CHAR(DATA_CRIACAO, 'DD/MM/YYYY') AS DATA_CRIACAO,
        TO_CHAR(DATA_ATUALIZACAO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO,
        STATUS_LEAD,
        MOTIVO_PERDA,
        TO_CHAR(DATA_CONCLUSAO, 'DD/MM/YYYY') AS DATA_CONCLUSAO
      FROM AD_LEADS
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
    `;

    const params: any = { idEmpresa };

    // Controle de acesso baseado no perfil
    if (!isAdmin) {
      if (vendedoresEquipe && vendedoresEquipe.length > 0) {
        // Gerente: ver leads seus e da equipe
        const allVendedores = [codVendedor, ...vendedoresEquipe].filter(Boolean);
        console.log('👥 [Oracle] Filtro de equipe - Vendedores permitidos:', allVendedores);
        sql += ` AND CODUSUARIO IN (
          SELECT CODUSUARIO FROM AD_USUARIOSVENDAS 
          WHERE CODVEND IN (${allVendedores.join(',')})
        )`;
      } else if (codUsuario) {
        // Vendedor: ver apenas seus leads
        console.log('👤 [Oracle] Filtro individual - CODUSUARIO:', codUsuario);
        sql += ` AND CODUSUARIO = :codUsuario`;
        params.codUsuario = codUsuario;
      }
    } else {
      console.log('👑 [Oracle] Admin - SEM filtro de usuário');
    }

    // Filtros de data
    if (dataInicio) {
      sql += ` AND DATA_CRIACAO >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`;
      params.dataInicio = dataInicio;
      console.log('📅 [Oracle] Filtro DATA_CRIACAO >=', dataInicio);
    }

    if (dataFim) {
      sql += ` AND DATA_CRIACAO <= TO_DATE(:dataFim, 'YYYY-MM-DD')`;
      params.dataFim = dataFim;
      console.log('📅 [Oracle] Filtro DATA_CRIACAO <=', dataFim);
    }

    // Filtro por funil
    if (codFunil) {
      sql += ` AND CODFUNIL = :codFunil`;
      params.codFunil = codFunil;
      console.log('🎯 [Oracle] Filtro CODFUNIL =', codFunil);
    }

    // Filtro por parceiro
    if (codParc) {
      sql += ` AND CODPARC = :codParc`;
      params.codParc = codParc;
      console.log('👥 [Oracle] Filtro CODPARC =', codParc);
    }

    sql += ` ORDER BY DATA_CRIACAO DESC`;

    console.log('📝 [Oracle] SQL Final:', sql);
    console.log('🔧 [Oracle] Params:', params);

    const result = await oracleService.executeQuery<Lead>(sql, params);
    console.log(`✅ [Oracle] ${result.length} leads encontrados`);
    
    // Log dos CODLEADs retornados para debug
    if (result.length > 0) {
      console.log('📋 [Oracle] CODLEADs retornados:', result.map(l => l.CODLEAD).join(', '));
    }

    // Verificar se o lead 121 está no resultado
    const lead121 = result.find(l => l.CODLEAD === '121');
    if (lead121) {
      console.log('✅ Lead 121 ENCONTRADO no resultado:', lead121);
    } else {
      console.log('❌ Lead 121 NÃO ENCONTRADO no resultado');
      
      // Buscar lead 121 diretamente sem filtros
      const lead121Direto = await oracleService.executeOne(
        `SELECT CODLEAD, CODFUNIL, CODESTAGIO, CODUSUARIO, ATIVO, DATA_CRIACAO FROM AD_LEADS WHERE CODLEAD = 121`,
        {}
      );
      console.log('🔍 Lead 121 direto do banco (sem filtros):', lead121Direto);
    }

    return result;

  } catch (error) {
    console.error('❌ [Oracle] Erro ao consultar leads:', error);
    throw error;
  }
}

export async function salvarLead(lead: Partial<Lead>, idEmpresa: number, codUsuarioCriador?: number): Promise<Lead> {
  console.log('💾 [Oracle] Salvando lead:', { lead, idEmpresa, codUsuarioCriador });

  try {
    const isUpdate = !!lead.CODLEAD;

    if (isUpdate) {
      // Atualizar lead existente

      // Converter data de YYYY-MM-DD para DD/MM/YYYY se necessário
      let dataVencimentoFormatada = lead.DATA_VENCIMENTO;
      if (dataVencimentoFormatada && dataVencimentoFormatada.includes('-')) {
        const [ano, mes, dia] = dataVencimentoFormatada.split('-');
        dataVencimentoFormatada = `${dia}/${mes}/${ano}`;
      }

      const sql = `
        UPDATE AD_LEADS
        SET NOME = :nome,
            DESCRICAO = :descricao,
            VALOR = :valor,
            CODESTAGIO = :codEstagio,
            CODFUNIL = :codFunil,
            DATA_VENCIMENTO = ${dataVencimentoFormatada ? "TO_DATE(:dataVencimento, 'DD/MM/YYYY')" : 'NULL'},
            TIPO_TAG = :tipoTag,
            COR_TAG = :corTag,
            CODPARC = :codParc
        WHERE CODLEAD = :codLead
          AND ID_EMPRESA = :idEmpresa
      `;

      const params: any = {
        nome: lead.NOME,
        descricao: lead.DESCRICAO || null,
        valor: lead.VALOR || 0,
        codEstagio: lead.CODESTAGIO || null,
        codFunil: lead.CODFUNIL || null,
        tipoTag: lead.TIPO_TAG || null,
        corTag: lead.COR_TAG || '#3b82f6',
        codParc: lead.CODPARC || null,
        codLead: lead.CODLEAD,
        idEmpresa
      };

      if (dataVencimentoFormatada) {
        params.dataVencimento = dataVencimentoFormatada;
      }

      await oracleService.executeQuery(sql, params);

      console.log(`✅ [Oracle] Lead ${lead.CODLEAD} atualizado`);

      // Buscar lead atualizado
      const leadAtualizado = await oracleService.executeOne<Lead>(
        `SELECT * FROM AD_LEADS WHERE CODLEAD = :codLead`,
        { codLead: lead.CODLEAD }
      );

      return leadAtualizado!;

    } else {
      // Inserir novo lead

      // Converter data de YYYY-MM-DD para DD/MM/YYYY se necessário
      let dataVencimentoFormatada = lead.DATA_VENCIMENTO;
      if (dataVencimentoFormatada && dataVencimentoFormatada.includes('-')) {
        const [ano, mes, dia] = dataVencimentoFormatada.split('-');
        dataVencimentoFormatada = `${dia}/${mes}/${ano}`;
      }

      const sql = `
        INSERT INTO AD_LEADS (
          ID_EMPRESA, NOME, DESCRICAO, VALOR, CODESTAGIO, CODFUNIL,
          DATA_VENCIMENTO, TIPO_TAG, COR_TAG, CODPARC, CODUSUARIO,
          ATIVO, STATUS_LEAD
        ) VALUES (
          :idEmpresa, :nome, :descricao, :valor, :codEstagio, :codFunil,
          ${dataVencimentoFormatada ? "TO_DATE(:dataVencimento, 'DD/MM/YYYY')" : 'NULL'}, :tipoTag, :corTag, :codParc,
          :codUsuario, 'S', 'EM_ANDAMENTO'
        )
      `;

      const params: any = {
        idEmpresa,
        nome: lead.NOME,
        descricao: lead.DESCRICAO || null,
        valor: lead.VALOR || 0,
        codEstagio: lead.CODESTAGIO || null,
        codFunil: lead.CODFUNIL || null,
        tipoTag: lead.TIPO_TAG || null,
        corTag: lead.COR_TAG || '#3b82f6',
        codParc: lead.CODPARC || null,
        codUsuario: codUsuarioCriador || null
      };

      if (dataVencimentoFormatada) {
        params.dataVencimento = dataVencimentoFormatada;
      }

      console.log('📅 Data formatada para Oracle:', dataVencimentoFormatada);
      console.log('🔍 Params enviados:', params);

      await oracleService.executeQuery(sql, params);

      console.log(`✅ [Oracle] Novo lead criado`);

      // Buscar último lead criado
      const novoLead = await oracleService.executeOne<Lead>(
        `SELECT * FROM AD_LEADS WHERE ID_EMPRESA = :idEmpresa ORDER BY CODLEAD DESC FETCH FIRST 1 ROWS ONLY`,
        { idEmpresa }
      );

      return novoLead!;
    }

  } catch (error) {
    console.error('❌ [Oracle] Erro ao salvar lead:', error);
    throw error;
  }
}

export async function atualizarEstagioLead(codLead: string, novoEstagio: string, idEmpresa: number): Promise<Lead | undefined> {
  console.log('🔄 [Oracle] Atualizando estágio do lead:', { codLead, novoEstagio, idEmpresa });

  try {
    const sql = `
      UPDATE AD_LEADS
      SET CODESTAGIO = :novoEstagio
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sql, { novoEstagio, codLead, idEmpresa });
    console.log(`✅ [Oracle] Estágio do lead ${codLead} atualizado`);

    // Buscar lead atualizado
    const leadAtualizado = await oracleService.executeOne<Lead>(
      `SELECT * FROM AD_LEADS WHERE CODLEAD = :codLead`,
      { codLead }
    );

    return leadAtualizado!;

  } catch (error) {
    console.error('❌ [Oracle] Erro ao atualizar estágio:', error);
    throw error;
  }
}

export async function deletarLead(codLead: string, idEmpresa: number): Promise<void> {
  console.log('🗑️ [Oracle] Deletando lead:', { codLead, idEmpresa });

  try {
    const sql = `
      UPDATE AD_LEADS
      SET ATIVO = 'N'
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sql, { codLead, idEmpresa });
    console.log(`✅ [Oracle] Lead ${codLead} deletado`);

  } catch (error) {
    console.error('❌ [Oracle] Erro ao deletar lead:', error);
    throw error;
  }
}

// ==================== PRODUTOS DOS LEADS ====================

export async function consultarProdutosLead(codLead: string, idEmpresa: number): Promise<LeadProduto[]> {
  console.log('🔍 [Oracle] Consultando produtos do lead:', { codLead, idEmpresa });

  try {
    const sql = `
      SELECT 
        CODITEM,
        CODLEAD,
        ID_EMPRESA,
        CODPROD,
        DESCRPROD,
        QUANTIDADE,
        VLRUNIT,
        VLRTOTAL,
        ATIVO,
        TO_CHAR(DATA_INCLUSAO, 'DD/MM/YYYY') AS DATA_INCLUSAO
      FROM AD_ADLEADSPRODUTOS
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
    `;

    const result = await oracleService.executeQuery<LeadProduto>(sql, { codLead, idEmpresa });
    console.log(`✅ [Oracle] ${result.length} produtos encontrados`);
    return result;

  } catch (error) {
    console.error('❌ [Oracle] Erro ao consultar produtos do lead:', error);
    throw error;
  }
}

export async function adicionarProdutoLead(produto: Omit<LeadProduto, 'CODITEM' | 'DATA_INCLUSAO'>, idEmpresa: number): Promise<LeadProduto> {
  console.log('➕ [Oracle] Adicionando produto ao lead:', { produto, idEmpresa });

  try {
    const sql = `
      INSERT INTO AD_ADLEADSPRODUTOS (
        CODLEAD, ID_EMPRESA, CODPROD, DESCRPROD, QUANTIDADE, VLRUNIT, VLRTOTAL, ATIVO
      ) VALUES (
        :codLead, :idEmpresa, :codProd, :descrProd, :quantidade, :vlrUnit, :vlrTotal, 'S'
      )
    `;

    await oracleService.executeQuery(sql, {
      codLead: produto.CODLEAD,
      idEmpresa,
      codProd: produto.CODPROD,
      descrProd: produto.DESCRPROD,
      quantidade: produto.QUANTIDADE,
      vlrUnit: produto.VLRUNIT,
      vlrTotal: produto.VLRTOTAL
    });

    console.log(`✅ [Oracle] Produto adicionado ao lead`);

    // Atualizar valor total do lead
    const totalResult = await oracleService.executeOne<{ TOTAL: number }>(
      `SELECT NVL(SUM(VLRTOTAL), 0) AS TOTAL FROM AD_ADLEADSPRODUTOS WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa AND ATIVO = 'S'`,
      { codLead: produto.CODLEAD, idEmpresa }
    );

    const novoValorTotal = totalResult?.TOTAL || 0;

    await oracleService.executeQuery(
      `UPDATE AD_LEADS SET VALOR = :valor WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa`,
      { valor: novoValorTotal, codLead: produto.CODLEAD, idEmpresa }
    );

    // Buscar o produto recém-criado
    const produtos = await consultarProdutosLead(produto.CODLEAD, idEmpresa);
    return produtos[produtos.length - 1];

  } catch (error) {
    console.error('❌ [Oracle] Erro ao adicionar produto ao lead:', error);
    throw error;
  }
}

export async function removerProdutoLead(codItem: string, codLead: string, idEmpresa: number): Promise<{ novoValorTotal: number }> {
  console.log('➖ [Oracle] Removendo produto do lead:', { codItem, codLead, idEmpresa });

  try {
    // Inativar produto
    await oracleService.executeQuery(
      `UPDATE AD_ADLEADSPRODUTOS SET ATIVO = 'N' WHERE CODITEM = :codItem AND ID_EMPRESA = :idEmpresa`,
      { codItem, idEmpresa }
    );

    // Recalcular valor total
    const totalResult = await oracleService.executeOne<{ TOTAL: number }>(
      `SELECT NVL(SUM(VLRTOTAL), 0) AS TOTAL FROM AD_ADLEADSPRODUTOS WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa AND ATIVO = 'S'`,
      { codLead, idEmpresa }
    );

    const novoValorTotal = totalResult?.TOTAL || 0;

    // Atualizar valor do lead
    await oracleService.executeQuery(
      `UPDATE AD_LEADS SET VALOR = :valor WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa`,
      { valor: novoValorTotal, codLead, idEmpresa }
    );

    console.log(`✅ [Oracle] Produto removido e valor atualizado`);
    return { novoValorTotal };

  } catch (error) {
    console.error('❌ [Oracle] Erro ao remover produto do lead:', error);
    throw error;
  }
}

// ==================== ATIVIDADES DOS LEADS ====================

export async function consultarAtividades(
  codLead: string, 
  idEmpresa: number, 
  ativo: string = 'S', 
  codUsuario?: number,
  usuariosPermitidos?: number[]
): Promise<any[]> {
  console.log('🔍 [Oracle] Consultando atividades:', { codLead, idEmpresa, ativo, codUsuario, usuariosPermitidos });

  let query = `
      SELECT 
        CODATIVIDADE,
        CODLEAD,
        TIPO,
        TITULO,
        DESCRICAO,
        TO_CHAR(DATA_INICIO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_INICIO,
        TO_CHAR(DATA_FIM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_FIM,
        COR,
        ATIVO,
        DADOS_COMPLEMENTARES,
        STATUS,
        TO_CHAR(DATA_CRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_CRIACAO,
        CODUSUARIO
      FROM AD_ADLEADSATIVIDADES
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = :ativo
    `;

  const params: any = { idEmpresa, ativo };

  if (codLead) {
    query += ` AND CODLEAD = :codLead`;
    params.codLead = codLead;
  }

  // Filtrar por usuário específico se fornecido
  if (codUsuario) {
    query += ` AND CODUSUARIO = :codUsuario`;
    params.codUsuario = codUsuario;
  }
  // OU filtrar por lista de usuários permitidos (gerente vendo equipe)
  else if (usuariosPermitidos && usuariosPermitidos.length > 0) {
    query += ` AND CODUSUARIO IN (${usuariosPermitidos.join(',')})`;
    console.log(`🔐 Filtrando atividades para usuários: ${usuariosPermitidos.join(', ')}`);
  }

  query += ` ORDER BY ORDEM DESC`;

  console.log('📋 [Oracle] Query:', query);
  console.log('📋 [Oracle] Binds:', params);

  const result = await oracleService.executeQuery<LeadAtividade>(query, params);

  console.log('📊 [Oracle] Rows retornadas:', result.length);
  if (result.length > 0) {
    console.log('📝 [Oracle] Primeira atividade - CODATIVIDADE:', result[0].CODATIVIDADE, 'TITULO:', result[0].TITULO);
  }

  const atividades = (result || []).map((row: any) => {
    let dadosComplementares: any = {};
    try {
      if (row.DADOS_COMPLEMENTARES) {
        dadosComplementares = typeof row.DADOS_COMPLEMENTARES === 'string'
          ? JSON.parse(row.DADOS_COMPLEMENTARES)
          : row.DADOS_COMPLEMENTARES;
      }
    } catch (e) {
      console.warn('⚠️ Erro ao parsear DADOS_COMPLEMENTARES:', e);
    }

    // Converter data do formato Oracle (DD/MM/YYYY HH24:MI:SS) para ISO sem alterar timezone
    const converterDataOracleParaISO = (dataOracle: string) => {
      if (!dataOracle) return new Date().toISOString();

      try {
        // Formato: "12/11/2025 15:36:00"
        const partes = dataOracle.split(' ');
        const [dia, mes, ano] = partes[0].split('/');
        const hora = partes[1] || '00:00:00';

        // Criar data no formato ISO sem conversão de timezone
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}`;
      } catch (e) {
        console.error('Erro ao converter data:', dataOracle, e);
        return new Date().toISOString();
      }
    };

    const atividade = {
      CODATIVIDADE: row.CODATIVIDADE?.toString() || '',
      CODLEAD: row.CODLEAD?.toString() || '',
      TIPO: row.TIPO || 'TAREFA',
      TITULO: row.TITULO || '',
      DESCRICAO: row.DESCRICAO || '',
      DATA_HORA: converterDataOracleParaISO(row.DATA_HORA),
      DATA_INICIO: converterDataOracleParaISO(row.DATA_INICIO),
      DATA_FIM: converterDataOracleParaISO(row.DATA_FIM),
      CODUSUARIO: row.CODUSUARIO,
      DADOS_COMPLEMENTARES: dadosComplementares,
      NOME_USUARIO: row.NOME_USUARIO || '',
      COR: row.COR || '#22C55E',
      ORDEM: row.ORDEM,
      ATIVO: row.ATIVO || 'S',
      STATUS: row.STATUS || 'AGUARDANDO'
    };

    console.log('🔄 [Oracle] Atividade mapeada:', {
      CODATIVIDADE: atividade.CODATIVIDADE,
      TITULO: atividade.TITULO,
      DATA_INICIO: atividade.DATA_INICIO,
      STATUS: atividade.STATUS,
      ATIVO: atividade.ATIVO
    });

    return atividade;
  });

  console.log(`✅ [Oracle] ${atividades.length} atividades encontradas e mapeadas`);
  return atividades;
}

export async function criarAtividade(atividade: Partial<LeadAtividade>, idEmpresa: number): Promise<LeadAtividade> {
  console.log('➕ [Oracle] Criando atividade:', { atividade, idEmpresa });

  try {
    // Buscar maior ordem
    const ordemResult = await oracleService.executeOne<{ ORDEM: number }>(
      atividade.CODLEAD 
        ? `SELECT NVL(MAX(ORDEM), 0) AS ORDEM FROM AD_ADLEADSATIVIDADES WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa`
        : `SELECT NVL(MAX(ORDEM), 0) AS ORDEM FROM AD_ADLEADSATIVIDADES WHERE ID_EMPRESA = :idEmpresa`,
      atividade.CODLEAD ? { codLead: atividade.CODLEAD, idEmpresa } : { idEmpresa }
    );

    const novaOrdem = (ordemResult?.ORDEM || 0) + 1;

    // Determinar status
    const dataInicio = atividade.DATA_INICIO ? new Date(atividade.DATA_INICIO) : new Date();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataInicio.setHours(0, 0, 0, 0);
    const statusInicial = dataInicio < hoje ? 'ATRASADO' : 'AGUARDANDO';

    // Formatar datas para o padrão Oracle DD/MM/YYYY HH24:MI:SS
    const formatarDataParaOracle = (dataISO: string | undefined) => {
      if (!dataISO) return null;
      const date = new Date(dataISO);
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const hora = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const seg = String(date.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
    };

    const dataInicioFormatada = formatarDataParaOracle(atividade.DATA_INICIO);
    const dataFimFormatada = formatarDataParaOracle(atividade.DATA_FIM);

    console.log('📅 Datas formatadas:', { dataInicioFormatada, dataFimFormatada });

    // Sempre incluir CODLEAD no INSERT, mas pode ser NULL
    const sql = `
      INSERT INTO AD_ADLEADSATIVIDADES (
        CODLEAD, ID_EMPRESA, TIPO, TITULO, DESCRICAO, DATA_HORA, 
        DATA_INICIO, DATA_FIM, CODUSUARIO, DADOS_COMPLEMENTARES, 
        COR, ORDEM, ATIVO, STATUS
      ) VALUES (
        :codLead, :idEmpresa, :tipo, :titulo, :descricao, 
        TO_TIMESTAMP(:dataHora, 'DD/MM/YYYY HH24:MI:SS'), 
        TO_TIMESTAMP(:dataInicio, 'DD/MM/YYYY HH24:MI:SS'), 
        TO_TIMESTAMP(:dataFim, 'DD/MM/YYYY HH24:MI:SS'), 
        :codUsuario, :dadosComplementares, :cor, :ordem, 'S', :status
      )
    `;

    const params: any = {
      codLead: atividade.CODLEAD || null,
      idEmpresa,
      tipo: atividade.TIPO || 'TAREFA',
      titulo: atividade.TITULO || 'Sem título',
      descricao: atividade.DESCRICAO || '',
      dataHora: formatarDataParaOracle(new Date().toISOString()),
      dataInicio: dataInicioFormatada,
      dataFim: dataFimFormatada,
      codUsuario: atividade.CODUSUARIO || null,
      dadosComplementares: atividade.DADOS_COMPLEMENTARES || null,
      cor: atividade.COR || '#22C55E',
      ordem: novaOrdem,
      status: statusInicial
    };

    await oracleService.executeQuery(sql, params);

    console.log(`✅ [Oracle] Atividade criada`);

    // Buscar a atividade criada
    const atividadeCriada = await oracleService.executeOne<any>(
      `SELECT 
        CODATIVIDADE,
        CODLEAD,
        TIPO,
        TITULO,
        DESCRICAO,
        TO_CHAR(DATA_CRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_CRIACAO,
        TO_CHAR(DATA_INICIO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_INICIO,
        TO_CHAR(DATA_FIM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_FIM,
        CODUSUARIO,
        DADOS_COMPLEMENTARES,
        COR,
        ORDEM,
        ATIVO,
        STATUS
      FROM AD_ADLEADSATIVIDADES 
      WHERE ID_EMPRESA = :idEmpresa 
      ORDER BY CODATIVIDADE DESC 
      FETCH FIRST 1 ROWS ONLY`,
      { idEmpresa }
    );

    console.log('🔍 [Oracle] Atividade buscada:', atividadeCriada?.CODATIVIDADE);

    if (!atividadeCriada) {
      throw new Error('Atividade criada mas não foi possível recuperá-la');
    }

    // Converter data do formato Oracle (DD/MM/YYYY HH24:MI:SS) para ISO sem alterar timezone
    const converterDataOracleParaISO = (dataOracle: string) => {
      if (!dataOracle) return new Date().toISOString();

      try {
        // Formato: "12/11/2025 15:36:00"
        const partes = dataOracle.split(' ');
        const [dia, mes, ano] = partes[0].split('/');
        const hora = partes[1] || '00:00:00';

        // Criar data no formato ISO sem conversão de timezone
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}`;
      } catch (e) {
        console.error('Erro ao converter data:', dataOracle, e);
        return new Date().toISOString();
      }
    };

    // Processar DADOS_COMPLEMENTARES de forma segura
    let dadosComplementaresStr = '';
    try {
      if (atividadeCriada.DADOS_COMPLEMENTARES) {
        // Se já for string, usar diretamente
        if (typeof atividadeCriada.DADOS_COMPLEMENTARES === 'string') {
          dadosComplementaresStr = atividadeCriada.DADOS_COMPLEMENTARES;
        } else {
          // Se for objeto, converter para string
          dadosComplementaresStr = JSON.stringify(atividadeCriada.DADOS_COMPLEMENTARES);
        }
      }
    } catch (e) {
      console.warn('⚠️ Erro ao processar DADOS_COMPLEMENTARES:', e);
      dadosComplementaresStr = '';
    }

    // Criar objeto limpo sem referências circulares - usando apenas tipos primitivos
    const atividadeLimpa: LeadAtividade = {
      CODATIVIDADE: String(atividadeCriada.CODATIVIDADE || ''),
      CODLEAD: atividadeCriada.CODLEAD ? String(atividadeCriada.CODLEAD) : '',
      ID_EMPRESA: idEmpresa,
      TIPO: String(atividadeCriada.TIPO || 'TAREFA'),
      TITULO: String(atividadeCriada.TITULO || ''),
      DESCRICAO: String(atividadeCriada.DESCRICAO || ''),
      DATA_HORA: converterDataOracleParaISO(atividadeCriada.DATA_CRIACAO),
      DATA_INICIO: converterDataOracleParaISO(atividadeCriada.DATA_INICIO),
      DATA_FIM: converterDataOracleParaISO(atividadeCriada.DATA_FIM),
      CODUSUARIO: Number(atividadeCriada.CODUSUARIO || 0),
      DADOS_COMPLEMENTARES: dadosComplementaresStr,
      NOME_USUARIO: '',
      COR: String(atividadeCriada.COR || '#22C55E'),
      ORDEM: Number(novaOrdem),
      ATIVO: String(atividadeCriada.ATIVO || 'S'),
      STATUS: String(atividadeCriada.STATUS || 'AGUARDANDO')
    };

    console.log('✅ [Oracle] Atividade criada e serializada com sucesso');

    return atividadeLimpa;

  } catch (error) {
    console.error('❌ [Oracle] Erro ao criar atividade:', error);
    throw error;
  }
}

export async function atualizarStatusAtividade(codAtividade: string, status: 'AGUARDANDO' | 'ATRASADO' | 'REALIZADO', idEmpresa: number): Promise<void> {
  console.log('🔄 [Oracle] Atualizando status da atividade:', { codAtividade, status, idEmpresa });

  try {
    const sql = `
      UPDATE AD_ADLEADSATIVIDADES
      SET STATUS = :status
      WHERE CODATIVIDADE = :codAtividade
        AND ID_EMPRESA = :idEmpresa
    `;

    await oracleService.executeQuery(sql, { status, codAtividade, idEmpresa });
    console.log(`✅ [Oracle] Status da atividade ${codAtividade} atualizado para ${status}`);

  } catch (error) {
    console.error('❌ [Oracle] Erro ao atualizar status da atividade:', error);
    throw error;
  }
}
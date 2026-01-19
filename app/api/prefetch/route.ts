import { NextRequest, NextResponse } from 'next/server'
import { oracleService } from '@/lib/oracle-db'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando prefetch completo de dados do Oracle...')

    // Obter ID da empresa do usuário logado
    const cookieStore = cookies()
    const userCookie = cookieStore.get('user')

    console.log('🍪 Cookie de usuário:', userCookie ? 'encontrado' : 'não encontrado');

    if (!userCookie) {
      console.error('❌ Usuário não autenticado - cookie não encontrado');
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const userData = JSON.parse(userCookie.value)
    const idEmpresa = userData.ID_EMPRESA
    const userId = userData.id

    console.log('👤 Dados do usuário do cookie:', {
      id: userId,
      name: userData.name,
      ID_EMPRESA: idEmpresa
    });

    if (!idEmpresa || !userId) {
      return NextResponse.json(
        { error: 'Empresa ou usuário não identificado' },
        { status: 400 }
      )
    }

    console.log(`📊 Buscando todos os dados para empresa ${idEmpresa} e usuário ${userId}`)

    console.log('🔄 Iniciando prefetch de todas as entidades...')

    // Fazer requisições em paralelo para otimizar tempo
    const [
      parceirosResult,
      produtosResult,
      tiposNegociacaoResult,
      tiposOperacaoResult,
      pedidosResult,
      financeiroResult,
      usuariosResult,
      vendedoresResult,
      estoquesResult,
      tabelasPrecosResult,
      excecoesPrecosResult,
      tiposPedidoResult,
      tabelasPrecosConfigResult,
      volumesResult,
      regrasImpostosResult
    ] = await Promise.allSettled([
      prefetchParceiros(idEmpresa, userId),
      prefetchProdutos(idEmpresa),
      prefetchTiposNegociacao(idEmpresa),
      prefetchTiposOperacao(idEmpresa),
      prefetchPedidos(idEmpresa, userId),
      prefetchFinanceiro(idEmpresa, userId),
      prefetchUsuarios(idEmpresa),
      prefetchVendedores(idEmpresa),
      prefetchEstoques(idEmpresa),
      prefetchTabelasPrecos(idEmpresa),
      prefetchExcecoesPrecos(idEmpresa),
      prefetchTiposPedido(idEmpresa),
      prefetchTabelasPrecosConfig(idEmpresa),
      prefetchVolumes(idEmpresa),
      prefetchRegrasImpostos(idEmpresa)
    ])

    console.log('📊 Status dos resultados do prefetch:')
    console.log('  - Parceiros:', parceirosResult.status)
    console.log('  - Produtos:', produtosResult.status)
    console.log('  - Tipos Negociação:', tiposNegociacaoResult.status)
    console.log('  - Tipos Operação:', tiposOperacaoResult.status)
    console.log('  - Pedidos:', pedidosResult.status)
    console.log('  - Financeiro:', financeiroResult.status)
    console.log('  - Usuários:', usuariosResult.status)
    console.log('  - Vendedores:', vendedoresResult.status)
    console.log('  - Estoques:', estoquesResult.status)
    console.log('  - Tabelas Preços:', tabelasPrecosResult.status)
    console.log('  - Exceções Preços:', excecoesPrecosResult.status)
    console.log('  - Tipos Pedido:', tiposPedidoResult.status)
    console.log('  - Tabelas Preços Config:', tabelasPrecosConfigResult.status)
    console.log('  - Volumes:', volumesResult.status)

    console.log('✅ Todas as requisições de prefetch foram concluídas')

    const usuariosRaw = usuariosResult.status === 'fulfilled' ? usuariosResult.value.data : [];
    const usuariosMapeados = usuariosRaw.map((usuario: any) => ({
      id: usuario.CODUSUARIO,
      name: usuario.NOME,
      email: usuario.EMAIL,
      role: usuario.FUNCAO,
      status: usuario.STATUS,
      avatar: usuario.AVATAR,
      codVend: usuario.CODVEND
    }));

    // Processar resultados
    const results = {
      parceiros: {
        count: parceirosResult.status === 'fulfilled' ? parceirosResult.value.count : 0,
        data: parceirosResult.status === 'fulfilled' ? parceirosResult.value.data : [],
        error: parceirosResult.status === 'rejected' ? parceirosResult.reason?.message : null
      },
      produtos: {
        count: produtosResult.status === 'fulfilled' ? produtosResult.value.count : 0,
        data: produtosResult.status === 'fulfilled' ? produtosResult.value.data : [],
        error: produtosResult.status === 'rejected' ? produtosResult.reason?.message : null
      },
      tiposNegociacao: {
        count: tiposNegociacaoResult.status === 'fulfilled' ? tiposNegociacaoResult.value.count : 0,
        data: tiposNegociacaoResult.status === 'fulfilled' ? tiposNegociacaoResult.value.data : [],
        error: tiposNegociacaoResult.status === 'rejected' ? tiposNegociacaoResult.reason?.message : null
      },
      tiposOperacao: {
        count: tiposOperacaoResult.status === 'fulfilled' ? tiposOperacaoResult.value.count : 0,
        data: tiposOperacaoResult.status === 'fulfilled' ? tiposOperacaoResult.value.data : [],
        error: tiposOperacaoResult.status === 'rejected' ? tiposOperacaoResult.reason?.message : null
      },
      pedidos: {
        count: pedidosResult.status === 'fulfilled' ? pedidosResult.value.count : 0,
        data: pedidosResult.status === 'fulfilled' ? pedidosResult.value.data : [],
        error: pedidosResult.status === 'rejected' ? pedidosResult.reason?.message : null
      },
      financeiro: {
        count: financeiroResult.status === 'fulfilled' ? financeiroResult.value.count : 0,
        data: financeiroResult.status === 'fulfilled' ? financeiroResult.value.data : [],
        error: financeiroResult.status === 'rejected' ? financeiroResult.reason?.message : null
      },
      usuarios: {
        count: usuariosMapeados?.length || 0,
        data: usuariosMapeados || [],
        error: usuariosResult.status === 'rejected' ? usuariosResult.reason?.message : null
      },
      vendedores: {
        count: vendedoresResult.status === 'fulfilled' ? vendedoresResult.value.count : 0,
        data: vendedoresResult.status === 'fulfilled' ? vendedoresResult.value.data : [],
        error: vendedoresResult.status === 'rejected' ? vendedoresResult.reason?.message : null
      },
      estoques: {
        count: estoquesResult.status === 'fulfilled' ? estoquesResult.value.count : 0,
        data: estoquesResult.status === 'fulfilled' ? estoquesResult.value.data : [],
        error: estoquesResult.status === 'rejected' ? estoquesResult.reason?.message : null
      },
      tabelasPrecos: {
        count: tabelasPrecosResult.status === 'fulfilled' ? tabelasPrecosResult.value.count : 0,
        data: tabelasPrecosResult.status === 'fulfilled' ? tabelasPrecosResult.value.data : [],
        error: tabelasPrecosResult.status === 'rejected' ? tabelasPrecosResult.reason?.message : null,
        tabelas: tabelasPrecosResult.status === 'fulfilled' ? tabelasPrecosResult.value.data : [] // Adicionar alias para compatibilidade
      },
      excecoesPrecos: {
        count: excecoesPrecosResult.status === 'fulfilled' ? excecoesPrecosResult.value.count : 0,
        data: excecoesPrecosResult.status === 'fulfilled' ? excecoesPrecosResult.value.data : [],
        error: excecoesPrecosResult.status === 'rejected' ? excecoesPrecosResult.reason?.message : null
      },
      tiposPedido: {
        count: tiposPedidoResult.status === 'fulfilled' ? tiposPedidoResult.value.count : 0,
        data: tiposPedidoResult.status === 'fulfilled' ? (Array.isArray(tiposPedidoResult.value.data) ? tiposPedidoResult.value.data : []) : [],
        error: tiposPedidoResult.status === 'rejected' ? tiposPedidoResult.reason?.message : null
      },
      tabelasPrecosConfig: {
        count: tabelasPrecosConfigResult.status === 'fulfilled' ? tabelasPrecosConfigResult.value.count : 0,
        data: tabelasPrecosConfigResult.status === 'fulfilled' ? (Array.isArray(tabelasPrecosConfigResult.value.data) ? tabelasPrecosConfigResult.value.data : []) : [],
        error: tabelasPrecosConfigResult.status === 'rejected' ? tabelasPrecosConfigResult.reason?.message : null
      },
      volumes: {
        count: volumesResult.status === 'fulfilled' ? volumesResult.value.count : 0,
        data: volumesResult.status === 'fulfilled' ? volumesResult.value.data : [],
        error: volumesResult.status === 'rejected' ? volumesResult.reason?.message : null
      },
      regrasImpostos: {
        count: regrasImpostosResult.status === 'fulfilled' ? regrasImpostosResult.value.count : 0,
        data: regrasImpostosResult.status === 'fulfilled' ? regrasImpostosResult.value.data : [],
        error: regrasImpostosResult.status === 'rejected' ? regrasImpostosResult.reason?.message : null
      }
    }

    // Log específico para tipos de pedido
    if (results.tiposPedido.count > 0) {
      console.log('📋 Tipos de pedido carregados:', results.tiposPedido.count)
      console.log('📋 Amostra de tipos:', results.tiposPedido.data.slice(0, 2))
    } else {
      console.warn('⚠️ Nenhum tipo de pedido foi carregado!')
    }

    // Log específico para tabelas de preços config
    if (results.tabelasPrecosConfig.count > 0) {
      console.log('💰 Tabelas de preços configuradas carregadas:', results.tabelasPrecosConfig.count)
      console.log('💰 Amostra de tabelas:', results.tabelasPrecosConfig.data.slice(0, 2))
    } else {
      console.warn('⚠️ Nenhuma tabela de preços configurada foi carregada!')
    }

    // Retornar estrutura otimizada
    const optimizedResults = {
      ...results,
      tiposPedido: {
        ...results.tiposPedido,
        // Adicionar array direto para facilitar acesso
        tipos: results.tiposPedido.data
      },
      tabelasPrecosConfig: {
        ...results.tabelasPrecosConfig,
        // Adicionar array direto para facilitar acesso
        configs: results.tabelasPrecosConfig.data
      }
    }

    // Log específico para exceções de preços
    if (results.excecoesPrecos.count > 0) {
      console.log('💰 Exceções de preços carregadas:', results.excecoesPrecos.count)
      console.log('💰 Amostra de exceções:', results.excecoesPrecos.data.slice(0, 3))
    } else {
      console.warn('⚠️ Nenhuma exceção de preço foi carregada!')
    }

    // Log de resultados
    Object.entries(results).forEach(([key, value]) => {
      if (value.error) {
        console.error(`❌ Erro ao carregar ${key}:`, value.error)
      } else {
        console.log(`✅ ${key} carregados: ${value.count} registros`)
      }
    })

    const totalRegistros = Object.values(results).reduce((sum, r) => sum + r.count, 0)
    console.log(`✅ Prefetch concluído - ${totalRegistros} registros totais`)

    // Mapear produtos para adicionar _id se não existir
    const produtosComId = produtosResult.status === 'fulfilled' ? produtosResult.value.data.map((p: any) => ({
      ...p,
      _id: p.CODPROD?.toString() || Math.random().toString()
    })) : [];

    // Mapear parceiros para adicionar _id se não existir
    const parceirosComId = parceirosResult.status === 'fulfilled' ? parceirosResult.value.data.map((p: any) => ({
      ...p,
      _id: p.CODPARC?.toString() || Math.random().toString()
    })) : [];

    // Mapear financeiro para adicionar _id se não existir
    const financeiroComId = financeiroResult.status === 'fulfilled' ? financeiroResult.value.data.map((f: any) => ({
      ...f,
      _id: f.NUFIN?.toString() || Math.random().toString()
    })) : [];

    // Mapear tipos de negociação para adicionar _id se não existir
    const tiposNegociacaoComId = tiposNegociacaoResult.status === 'fulfilled' ? tiposNegociacaoResult.value.data.map((t: any) => ({
      ...t,
      _id: t.CODTIPVENDA?.toString() || Math.random().toString()
    })) : [];

    // Mapear tipos de operação para adicionar _id se não existir
    const tiposOperacaoComId = tiposOperacaoResult.status === 'fulfilled' ? tiposOperacaoResult.value.data.map((t: any) => ({
      ...t,
      _id: t.CODTIPOPER?.toString() || Math.random().toString()
    })) : [];

    // Mapear tipos de pedido para adicionar _id se não existir
    const tiposPedidoComId = tiposPedidoResult.status === 'fulfilled' ? tiposPedidoResult.value.data.map((t: any) => ({
      ...t,
      _id: t.CODTIPOPER?.toString() || Math.random().toString()
    })) : [];

    // Mapear estoques para adicionar _id composto
    const estoquesComId = estoquesResult.status === 'fulfilled' ? estoquesResult.value.data.map((e: any) => ({
      ...e,
      _id: `${e.CODPROD}_${e.CODLOCAL}`
    })) : [];

    // Mapear tabelas de preços para adicionar _id composto
    const tabelasPrecosComId = tabelasPrecosResult.status === 'fulfilled' ? tabelasPrecosResult.value.data.map((t: any) => ({
      ...t,
      _id: `${t.NUTAB}_${t.CODTAB}`
    })) : [];


    // Mapear usuários para adicionar _id se não existir
    const usuariosComId = usuariosResult.status === 'fulfilled' ? usuariosResult.value.data.map((u: any) => ({
      ...u,
      _id: u.CODUSUARIO?.toString() || Math.random().toString(),
      id: u.CODUSUARIO,
      name: u.NOME,
      email: u.EMAIL,
      role: u.FUNCAO,
      status: u.STATUS,
      avatar: u.AVATAR || '',
      codVendedor: u.CODVEND
    })) : [];

    // Mapear pedidos para adicionar _id se não existir
    const pedidosComId = pedidosResult.status === 'fulfilled' ? pedidosResult.value.data.map((p: any) => ({
      ...p,
      _id: p.NUNOTA?.toString() || Math.random().toString()
    })) : [];

    // Mapear exceções de preços para adicionar _id composto
    const excecoesPrecosComId = excecoesPrecosResult.status === 'fulfilled' ? excecoesPrecosResult.value.data.map((e: any) => ({
      ...e,
      _id: `${e.CODPROD}_${e.NUTAB}_${e.CODLOCAL || '0'}`
    })) : [];

    // Mapear vendedores para adicionar _id se não existir
    const vendedoresComId = vendedoresResult.status === 'fulfilled' ? vendedoresResult.value.data.map((v: any) => ({
      ...v,
      _id: v.CODVEND?.toString() || Math.random().toString()
    })) : [];

    // Mapear volumes para adicionar _id composto
    const volumesComId = volumesResult.status === 'fulfilled' ? volumesResult.value.data.map((v: any) => ({
      ...v,
      _id: `${v.CODPROD}_${v.CODVOL}`
    })) : [];

    // Mapear regras de impostos para adicionar _id
    const regrasImpostosComId = regrasImpostosResult.status === 'fulfilled' ? regrasImpostosResult.value.data.map((r: any) => ({
      ...r,
      _id: r.ID_REGRA?.toString() || Math.random().toString()
    })) : [];

    return NextResponse.json({
      success: true,
      produtos: {
        count: produtosComId.length,
        data: produtosComId
      },
      parceiros: {
        count: parceirosComId.length,
        data: parceirosComId
      },
      financeiro: {
        count: financeiroComId.length,
        data: financeiroComId
      },
      tiposNegociacao: {
        count: tiposNegociacaoComId.length,
        data: tiposNegociacaoComId
      },
      tiposOperacao: {
        count: tiposOperacaoComId.length,
        data: tiposOperacaoComId
      },
      tiposPedido: {
        count: tiposPedidoComId.length,
        data: tiposPedidoComId
      },
      tabelasPrecosConfig: {
        count: tabelasPrecosConfigResult.status === 'fulfilled' ? tabelasPrecosConfigResult.value.count : 0,
        data: tabelasPrecosConfigResult.status === 'fulfilled' ? (Array.isArray(tabelasPrecosConfigResult.value.data) ? tabelasPrecosConfigResult.value.data : []) : []
      },
      estoques: {
        count: estoquesComId.length,
        data: estoquesComId
      },
      tabelasPrecos: {
        count: tabelasPrecosComId.length,
        data: tabelasPrecosComId
      },
      excecoesPrecos: {
        count: excecoesPrecosComId.length,
        data: excecoesPrecosComId
      },
      pedidos: {
        count: pedidosComId.length,
        data: pedidosComId
      },
      usuarios: {
        count: usuariosComId.length,
        data: usuariosComId
      },
      vendedores: {
        count: vendedoresComId.length,
        data: vendedoresComId
      },
      volumes: {
        count: volumesComId.length,
        data: volumesComId
      },
      regrasImpostos: {
        count: regrasImpostosComId.length,
        data: regrasImpostosComId
      }
    });
  } catch (error) {
    console.error('❌ Erro no prefetch de dados:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao fazer prefetch' },
      { status: 500 }
    )
  }
}

// Prefetch de parceiros do Oracle
async function prefetchParceiros(idEmpresa: number, userId: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando parceiros da empresa ${idEmpresa} para usuário ${userId} do Oracle...`)

    // Validar acesso do usuário
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;
    try {
      userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);
    } catch (error) {
      console.warn('⚠️ Usuário sem acesso validado, retornando lista vazia');
      return { count: 0, data: [] };
    }

    // Obter filtro de acesso
    const accessFilter = accessControlService.getParceirosWhereClause(userAccess);

    let sql = `
      SELECT 
        CODPARC,
        NOMEPARC,
        CGC_CPF,
        CODCID,
        ATIVO,
        TIPPESSOA,
        RAZAOSOCIAL,
        IDENTINSCESTAD,
        CEP,
        CODEND,
        NUMEND,
        COMPLEMENTO,
        CODBAI,
        LATITUDE,
        LONGITUDE,
        CLIENTE,
        CODVEND,
        CODTAB
      FROM AS_PARCEIROS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND CLIENTE = 'S'
    `;

    const binds: any = { idEmpresa };

    // Aplicar filtro de acesso
    if (accessFilter.clause) {
      sql += ` ${accessFilter.clause}`;
      Object.assign(binds, accessFilter.binds);
    }

    sql += ` ORDER BY NOMEPARC`;

    const parceiros = await oracleService.executeQuery(sql, binds);

    console.log(`✅ ${parceiros.length} parceiros encontrados no Oracle para o usuário ${userId}`);
    return { count: parceiros.length, data: parceiros };

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de parceiros do Oracle:', error);
    return { count: 0, data: [] };
  }
}

// Prefetch de produtos do Oracle
async function prefetchProdutos(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando TODOS os produtos da empresa ${idEmpresa} do Oracle...`)

    // Remover qualquer limitação de paginação para garantir que TODOS os produtos sejam carregados
    const sql = `
      SELECT 
        CODPROD,
        DESCRPROD,
        ATIVO
      FROM AS_PRODUTOS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY DESCRPROD
    `

    const produtos = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${produtos.length} produtos encontrados no Oracle (SEM LIMITE)`)
    return { count: produtos.length, data: produtos }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de produtos do Oracle:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de tipos de negociação
async function prefetchTiposNegociacao(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando tipos de negociação da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODTIPVENDA,
        DESCRTIPVENDA
      FROM AS_TIPOS_NEGOCIACAO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY DESCRTIPVENDA
    `

    const tipos = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${tipos.length} tipos de negociação encontrados`)

    // Salvar no cache do sessionStorage (via retorno para o cliente)
    return { count: tipos.length, data: tipos }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de tipos de negociação:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de tipos de operação
async function prefetchTiposOperacao(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando tipos de operação da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODTIPOPER,
        DESCROPER,
        ATIVO
      FROM AS_TIPOS_OPERACAO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY DESCROPER
    `

    const tipos = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${tipos.length} tipos de operação encontrados`)

    // Salvar no cache do sessionStorage (via retorno para o cliente)
    return { count: tipos.length, data: tipos }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de tipos de operação:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de pedidos
async function prefetchPedidos(idEmpresa: number, userId: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando pedidos da empresa ${idEmpresa}...`)

    // Validar acesso do usuário
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;
    try {
      userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);
    } catch (error) {
      console.warn('⚠️ Usuário sem acesso validado para pedidos');
      return { count: 0, data: [] };
    }

    let sql = `
      SELECT 
        c.NUNOTA,
        c.CODPARC,
        p.NOMEPARC AS PARCEIRO,
        c.CODVEND,
        v.APELIDO AS VENDEDOR,
        c.VLRNOTA,
        TO_CHAR(c.DTNEG, 'DD/MM/YYYY') AS DTNEG
      FROM AS_CABECALHO_NOTA c
      LEFT JOIN AS_PARCEIROS p ON c.CODPARC = p.CODPARC AND c.ID_SISTEMA = p.ID_SISTEMA AND p.SANKHYA_ATUAL = 'S'
      LEFT JOIN AS_VENDEDORES v ON c.CODVEND = v.CODVEND AND c.ID_SISTEMA = v.ID_SISTEMA AND v.SANKHYA_ATUAL = 'S'
      WHERE c.ID_SISTEMA = :idEmpresa
        AND c.SANKHYA_ATUAL = 'S'
        AND c.TIPMOV = 'V'
    `

    const binds: any = { idEmpresa }

    // Aplicar controle de acesso
    if (userAccess.codVendedor && !userAccess.isAdmin) {
      if (userAccess.vendedoresEquipe.length > 0) {
        const allVendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe];
        sql += ` AND c.CODVEND IN (${allVendedores.join(',')})`;
      } else {
        sql += ` AND c.CODVEND = :codVendedor`;
        binds.codVendedor = userAccess.codVendedor;
      }
    }

    sql += ` ORDER BY c.DTNEG DESC, c.NUNOTA DESC`;

    const pedidos = await oracleService.executeQuery(sql, binds);

    console.log(`✅ ${pedidos.length} pedidos encontrados`)
    return { count: pedidos.length, data: pedidos }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de pedidos:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de vendedores
async function prefetchVendedores(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando vendedores da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODVEND,
        APELIDO,
        TIPVEND,
        ATIVO,
        CODGER
      FROM AS_VENDEDORES
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY APELIDO
    `

    const vendedores = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${vendedores.length} vendedores encontrados`)
    return { count: vendedores.length, data: vendedores }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de vendedores:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de estoques
async function prefetchEstoques(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando estoques da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODPROD,
        CODLOCAL,
        ESTOQUE,
        ATIVO,
        CONTROLE
      FROM AS_ESTOQUES
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
        AND CONTROLE = 'E'
      ORDER BY CODPROD, CODLOCAL
    `

    const estoques = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${estoques.length} registros de estoque encontrados`)
    return { count: estoques.length, data: estoques }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de estoques:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de tabelas de preços
async function prefetchTabelasPrecos(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando tabelas de preços da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        ID_SISTEMA,
        NUTAB,
        CODTAB,
        DTVIGOR,
        TO_CHAR(DTVIGOR, 'DD/MM/YYYY') AS DTVIGOR_FORMATTED,
        PERCENTUAL,
        UTILIZADECCUSTO,
        CODTABORIG,
        DTALTER,
        JAPE_ID
      FROM AS_TABELA_PRECOS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY NUTAB
    `

    const tabelas = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${tabelas.length} tabelas de preços encontradas`)
    return { count: tabelas.length, data: tabelas }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de tabelas de preços:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de exceções de preços
async function prefetchExcecoesPrecos(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando exceções de preços da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODPROD,
        NUTAB,
        VLRVENDA,
        TIPO,
        CODLOCAL
      FROM AS_EXCECAO_PRECO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY CODPROD, NUTAB
    `

    const excecoes = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${excecoes.length} exceções de preços encontradas`)

    // Log de amostra para debug
    if (excecoes.length > 0) {
      console.log('📋 Amostra de exceções de preços:', excecoes.slice(0, 3))
    }

    return { count: excecoes.length, data: excecoes }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de exceções de preços:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de títulos financeiros
async function prefetchFinanceiro(idEmpresa: number, userId: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando títulos financeiros da empresa ${idEmpresa}...`)

    // Validar acesso do usuário
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;
    try {
      userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);
    } catch (error) {
      console.warn('⚠️ Usuário sem acesso validado para financeiro');
      return { count: 0, data: [] };
    }

    let sql = `
      SELECT 
        f.NUFIN,
        f.CODPARC,
        p.NOMEPARC,
        f.NUMNOTA,
        f.VLRDESDOB,
        f.VLRBAIXA,
        f.DTVENC,
        f.DTNEG,
        f.DHBAIXA,
        f.PROVISAO,
        f.RECDESP,
        f.NOSSONUM
      FROM AS_FINANCEIRO f
      LEFT JOIN AS_PARCEIROS p ON f.CODPARC = p.CODPARC AND f.ID_SISTEMA = p.ID_SISTEMA AND p.SANKHYA_ATUAL = 'S'
      WHERE f.ID_SISTEMA = :idEmpresa
        AND f.SANKHYA_ATUAL = 'S'
        AND f.RECDESP = 1
    `

    const binds: any = { idEmpresa }

    // Aplicar controle de acesso (mesma lógica de pedidos)
    if (userAccess.codVendedor && !userAccess.isAdmin) {
      sql += ` AND f.CODPARC IN (
        SELECT CODPARC FROM AS_PARCEIROS 
        WHERE ID_SISTEMA = :idEmpresa 
        AND SANKHYA_ATUAL = 'S'
      `;

      if (userAccess.vendedoresEquipe.length > 0) {
        const allVendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe];
        sql += ` AND CODVEND IN (${allVendedores.join(',')})`;
      } else {
        sql += ` AND CODVEND = :codVendedor`;
        binds.codVendedor = userAccess.codVendedor;
      }

      sql += `)`;
    }

    sql += ` ORDER BY f.DTVENC DESC`;

    const titulos = await oracleService.executeQuery(sql, binds);

    console.log(`✅ ${titulos.length} títulos financeiros encontrados`)
    return { count: titulos.length, data: titulos }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de títulos financeiros:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de tipos de pedido
async function prefetchTiposPedido(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log('[PREFETCH] Buscando tipos de pedido da empresa ' + idEmpresa + '...')

    const sql = `
      SELECT 
        CODTIPOPEDIDO,
        ID_EMPRESA,
        CODUSUARIO_CRIADOR,
        NOME,
        DESCRICAO,
        CODTIPOPER,
        MODELO_NOTA,
        TIPMOV,
        CODTIPVENDA,
        COR,
        ATIVO,
        DATA_CRIACAO,
        DATA_ATUALIZACAO
      FROM AD_TIPOSPEDIDO
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
      ORDER BY NOME
    `

    const tipos = await oracleService.executeQuery(sql, { idEmpresa })

    console.log('[PREFETCH] ' + tipos.length + ' tipos de pedido encontrados')

    // Salvar no Redis cache
    if (tipos.length > 0) {
      const { redisCacheService } = await import('@/lib/redis-cache-service')
      const cacheKey = `tipos_pedido:empresa:${idEmpresa}`
      await redisCacheService.set(cacheKey, tipos, 4 * 60 * 60 * 1000)
      console.log('[PREFETCH] Tipos de pedido salvos no Redis cache')
    }

    return { count: tipos.length, data: tipos }

  } catch (error) {
    console.error('[PREFETCH] Erro ao fazer prefetch de tipos de pedido:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de tabelas de precos configuradas
async function prefetchTabelasPrecosConfig(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log('[PREFETCH] Buscando tabelas de precos configuradas da empresa ' + idEmpresa + '...')

    const sql = `
      SELECT 
        CODCONFIG,
        ID_EMPRESA,
        CODUSUARIO_CRIADOR,
        NUTAB,
        CODTAB,
        DESCRICAO,
        ATIVO,
        DATA_CRIACAO,
        DATA_ATUALIZACAO
      FROM AD_TABELASPRECOSCONFIG
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
      ORDER BY CODTAB
    `

    const configs = await oracleService.executeQuery(sql, { idEmpresa })

    console.log('[PREFETCH] ' + configs.length + ' tabelas de precos configuradas encontradas')

    // Salvar no Redis cache
    if (configs.length > 0) {
      const { redisCacheService } = await import('@/lib/redis-cache-service')
      const cacheKey = `tabelas_precos_config:empresa:${idEmpresa}`
      await redisCacheService.set(cacheKey, configs, 4 * 60 * 60 * 1000)
      console.log('[PREFETCH] Tabelas de precos configuradas salvas no Redis cache')
    }

    return { count: configs.length, data: configs }

  } catch (error) {
    console.error('[PREFETCH] Erro ao fazer prefetch de tabelas de precos configuradas:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de usuários
async function prefetchUsuarios(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando usuários da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        CODUSUARIO,
        NOME,
        EMAIL,
        FUNCAO,
        STATUS,
        AVATAR,
        CODVEND
      FROM AD_USUARIOSVENDAS
      WHERE ID_EMPRESA = :idEmpresa
        AND STATUS = 'ativo'
      ORDER BY NOME
    `

    const usuarios = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${usuarios.length} usuários encontrados`)
    return { count: usuarios.length, data: usuarios }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de usuários:', error)
    return { count: 0, data: [] }
  }
}

// Prefetch de volumes alternativos
async function prefetchVolumes(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log('[PREFETCH] Buscando volumes alternativos da empresa ' + idEmpresa + '...')

    const sql = `
      SELECT 
        ID_SISTEMA,
        CODPROD,
        CODVOL,
        ATIVO,
        CAMADAS,
        CODBARRA,
        CONTROLE,
        DESCRDANFE,
        DESCRUNTRIBEXPORT,
        DIVIDEMULTIPLICA,
        LASTRO,
        M3,
        MULTIPVLR,
        OPCAOSEP,
        OPCOESGERAR0220,
        QTDDECIMAISUPF,
        QUANTIDADE,
        SELECIONADO,
        TIPCODBARRA,
        TIPGTINNFE,
        UNDTRIBRECOB,
        UNIDSELO,
        UNIDTRIB,
        UNTRIBEXPORTACAO
      FROM AS_VOLUME_ALTERNATIVO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY CODPROD, CODVOL
    `

    const volumes = await oracleService.executeQuery(sql, { idEmpresa })

    console.log('[PREFETCH] ' + volumes.length + ' volumes alternativos encontrados')
    return { count: volumes.length, data: volumes }

  } catch (error) {
    console.error('[PREFETCH] Erro ao fazer prefetch de volumes alternativos:', error)
    return { count: 0, data: [] }
  }
}
// Prefetch de regras de impostos
async function prefetchRegrasImpostos(idEmpresa: number): Promise<{ count: number, data: any[] }> {
  try {
    console.log(`🔍 Buscando regras de impostos da empresa ${idEmpresa}...`)

    const sql = `
      SELECT 
        ID_REGRA,
        NOME,
        DESCRICAO,
        NOTA_MODELO,
        CODIGO_EMPRESA,
        FINALIDADE_OPERACAO,
        CODIGO_NATUREZA,
        ATIVO
      FROM AS_REGRAS_IMPOSTOS
      WHERE ATIVO = 'S' AND ID_SISTEMA = :idEmpresa
      ORDER BY NOME
    `

    const regras = await oracleService.executeQuery(sql, { idEmpresa })

    console.log(`✅ ${regras.length} regras de impostos encontradas`)
    return { count: regras.length, data: regras }

  } catch (error) {
    console.error('❌ Erro ao fazer prefetch de regras de impostos:', error)
    return { count: 0, data: [] }
  }
}

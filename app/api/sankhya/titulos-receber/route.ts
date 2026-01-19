
import { NextRequest, NextResponse } from 'next/server'
import { oracleService } from '@/lib/oracle-db'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codParc = searchParams.get('codParceiro')
    const nomeParceiro = searchParams.get('parceiro')
    const dataInicio = searchParams.get('dataNegociacaoInicio')
    const dataFim = searchParams.get('dataNegociacaoFinal')
    const tipoFinanceiro = searchParams.get('tipoFinanceiro') // 1=Pendente, 2=Baixado, 3=Todos
    const statusFinanceiro = searchParams.get('statusFinanceiro') // 1=Real, 2=Provisão, 3=Todos

    console.log('🔍 [FINANCEIRO] Parâmetros recebidos:', {
      codParc,
      nomeParceiro,
      dataInicio,
      dataFim,
      tipoFinanceiro,
      statusFinanceiro
    })

    // Obter usuário
    const cookieStore = cookies()
    const userCookie = cookieStore.get('user')

    if (!userCookie) {
      console.error('❌ [FINANCEIRO] Usuário não autenticado')
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    const idEmpresa = user.ID_EMPRESA

    if (!idEmpresa) {
      console.error('❌ [FINANCEIRO] Empresa não identificada')
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 })
    }

    console.log('✅ [FINANCEIRO] ID Empresa:', idEmpresa)

    // Validar acesso do usuário
    const { accessControlService } = await import('@/lib/access-control-service');
    
    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);
      
      // Se buscando por parceiro específico (código ou nome), validar se o vendedor tem acesso
      if ((codParc || nomeParceiro) && !userAccess.isAdmin) {
        const parceirosFilter = accessControlService.getParceirosWhereClause(userAccess);
        
        // Construir query de validação
        let validacaoSql = `
          SELECT CODPARC, NOMEPARC
          FROM AS_PARCEIROS
          WHERE ID_SISTEMA = :idEmpresa
            AND SANKHYA_ATUAL = 'S'
            ${parceirosFilter.clause}
        `;
        
        const validacaoBinds: any = {
          idEmpresa,
          ...parceirosFilter.binds
        };

        if (codParc) {
          validacaoSql += ` AND CODPARC = :codParc`;
          validacaoBinds.codParc = codParc;
        } else if (nomeParceiro) {
          validacaoSql += ` AND UPPER(NOMEPARC) LIKE :nomeParceiro`;
          validacaoBinds.nomeParceiro = `%${nomeParceiro.toUpperCase()}%`;
        }
        
        const parceirosValidos = await oracleService.executeQuery(validacaoSql, validacaoBinds);

        if (parceirosValidos.length === 0) {
          console.warn(`⚠️ [FINANCEIRO] Parceiro não vinculado ao vendedor ${userAccess.codVendedor}`);
          return NextResponse.json({
            error: 'Parceiro não vinculado',
            message: 'Este parceiro não está vinculado ao seu usuário. Você só pode visualizar dados financeiros de parceiros vinculados a você.',
            titulos: [],
            totais: {
              real: 0,
              provisao: 0,
              aberto: 0,
              baixado: 0,
              valorReal: 0,
              valorProvisao: 0,
              valorAberto: 0,
              valorBaixado: 0
            }
          }, { status: 403 });
        }

        console.log(`✅ [FINANCEIRO] ${parceirosValidos.length} parceiro(s) validado(s)`);
      }
      
      // Construir critérios de busca
      const criterios: string[] = ['F.ID_SISTEMA = :idEmpresa', 'F.SANKHYA_ATUAL = \'S\'']
      const binds: any = { idEmpresa }

      // Aplicar filtro de acesso
      const financeiroAccessFilter = accessControlService.getFinanceiroWhereClause(userAccess);
      if (financeiroAccessFilter.clause) {
        criterios.push(financeiroAccessFilter.clause.replace('AND ', ''));
        Object.assign(binds, financeiroAccessFilter.binds);
      }

    if (codParc) {
      criterios.push('F.CODPARC = :codParc')
      binds.codParc = codParc
      console.log('🔍 [FINANCEIRO] Filtrando por parceiro:', codParc)
    }

    if (dataInicio) {
      criterios.push('F.DTNEG >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')')
      binds.dataInicio = dataInicio
      console.log('🔍 [FINANCEIRO] Data início:', dataInicio)
    }

    if (dataFim) {
      criterios.push('F.DTNEG <= TO_DATE(:dataFim, \'YYYY-MM-DD\')')
      binds.dataFim = dataFim
      console.log('🔍 [FINANCEIRO] Data fim:', dataFim)
    }

    // Filtro de Tipo Financeiro (Real/Provisão)
    if (statusFinanceiro && statusFinanceiro !== '3') {
      if (statusFinanceiro === '1') {
        criterios.push('F.PROVISAO = \'N\'')
        console.log('🔍 [FINANCEIRO] Filtrando: Real')
      } else if (statusFinanceiro === '2') {
        criterios.push('F.PROVISAO = \'S\'')
        console.log('🔍 [FINANCEIRO] Filtrando: Provisão')
      }
    }

    // Filtro de Status (Aberto/Baixado)
    if (tipoFinanceiro && tipoFinanceiro !== '3') {
      if (tipoFinanceiro === '1') {
        criterios.push('F.RECDESP = 1')
        console.log('🔍 [FINANCEIRO] Filtrando: Aberto')
      } else if (tipoFinanceiro === '2') {
        criterios.push('F.RECDESP = 0')
        console.log('🔍 [FINANCEIRO] Filtrando: Baixado')
      }
    }

    const whereClause = criterios.join(' AND ')
    console.log('📝 [FINANCEIRO] WHERE clause:', whereClause)

    const sql = `
      SELECT 
        F.NUFIN,
        F.CODPARC,
        F.DTVENC,
        F.VLRDESDOB,
        F.VLRBAIXA,
        F.PROVISAO,
        F.RECDESP,
        F.DTNEG,
        F.NUMNOTA,
        F.NOSSONUM,
        P.NOMEPARC
      FROM AS_FINANCEIRO F
      LEFT JOIN AS_PARCEIROS P ON F.CODPARC = P.CODPARC AND P.ID_SISTEMA = :idEmpresa AND P.SANKHYA_ATUAL = 'S'
      WHERE ${whereClause}
      ORDER BY F.DTVENC DESC
    `

    console.log('📊 [FINANCEIRO] Executando query...')
    
    const resultado = await oracleService.executeQuery(sql, binds)
    console.log(`✅ [FINANCEIRO] ${resultado.length} títulos retornados do banco`)

    if (resultado.length > 0) {
      console.log('📋 [FINANCEIRO] Primeiro título (Oracle raw):', resultado[0])
    }

    // Função auxiliar para converter valor do Oracle para número
    const parseOracleNumber = (value: any): number => {
      if (value === null || value === undefined) return 0
      
      // Se já é número, retornar
      if (typeof value === 'number') return value
      
      // Se é string, limpar e converter
      if (typeof value === 'string') {
        const cleaned = value.replace(',', '.')
        const parsed = parseFloat(cleaned)
        return isNaN(parsed) ? 0 : parsed
      }
      
      return 0
    }

    // Mapear dados do Oracle para o formato esperado
    const titulos = resultado.map((t: any) => {
      const vlrDesdob = parseOracleNumber(t.VLRDESDOB)
      const vlrBaixa = parseOracleNumber(t.VLRBAIXA)
      
      // Se está baixado (RECDESP = 0), usar valor baixado, senão usar valor desdobrado
      const valorFinal = t.RECDESP === 0 ? vlrBaixa : vlrDesdob
      
      const titulo = {
        nroTitulo: t.NUFIN?.toString() || '',
        parceiro: t.NOMEPARC || `Parceiro ${t.CODPARC}`,
        codParceiro: t.CODPARC?.toString() || '',
        valor: valorFinal,
        dataVencimento: t.DTVENC ? new Date(t.DTVENC).toISOString().split('T')[0] : '',
        dataNegociacao: t.DTNEG ? new Date(t.DTNEG).toISOString().split('T')[0] : '',
        status: t.RECDESP === 1 ? 'Aberto' : 'Baixado',
        tipoFinanceiro: t.PROVISAO === 'N' ? 'Real' : 'Provisão',
        tipoTitulo: 'Financeiro',
        numeroParcela: 1,
        origemFinanceiro: t.NUMNOTA ? `Nota ${t.NUMNOTA}` : 'Lançamento Direto',
        codigoEmpresa: idEmpresa,
        codigoNatureza: 0,
        boleto: {
          codigoBarras: null,
          nossoNumero: t.NOSSONUM || null,
          linhaDigitavel: null,
          numeroRemessa: null
        }
      }
      
      return titulo
    })

    // Calcular totais e métricas
    let totalReal = 0
    let totalProvisao = 0
    let totalAberto = 0
    let totalBaixado = 0
    let valorTotalReal = 0
    let valorTotalProvisao = 0
    let valorTotalAberto = 0
    let valorTotalBaixado = 0

    titulos.forEach((t: any) => {
      if (t.tipoFinanceiro === 'Real') {
        totalReal++
        valorTotalReal += t.valor
      } else {
        totalProvisao++
        valorTotalProvisao += t.valor
      }

      if (t.status === 'Aberto') {
        totalAberto++
        valorTotalAberto += t.valor
      } else {
        totalBaixado++
        valorTotalBaixado += t.valor
      }
    })

    console.log('📊 [FINANCEIRO] Métricas calculadas:', {
      totalReal,
      totalProvisao,
      totalAberto,
      totalBaixado,
      valorTotalReal,
      valorTotalProvisao,
      valorTotalAberto,
      valorTotalBaixado
    })

    if (titulos.length > 0) {
      console.log('📋 [FINANCEIRO] Primeiro título mapeado:', titulos[0])
    }

    return NextResponse.json({
        titulos,
        totais: {
          real: totalReal,
          provisao: totalProvisao,
          aberto: totalAberto,
          baixado: totalBaixado,
          valorReal: valorTotalReal,
          valorProvisao: valorTotalProvisao,
          valorAberto: valorTotalAberto,
          valorBaixado: valorTotalBaixado
        }
      })
    } catch (accessError: any) {
      console.error('❌ [FINANCEIRO] Erro de acesso:', accessError.message);
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }
  } catch (error: any) {
    console.error('❌ [FINANCEIRO] Erro ao buscar títulos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

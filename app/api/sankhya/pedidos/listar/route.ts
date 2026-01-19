
import { NextResponse } from 'next/server'
import { oracleService } from '@/lib/oracle-db'
import { usersService } from '@/lib/users-service'
import { cookies } from 'next/headers'

export const revalidate = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const dataInicio = searchParams.get('dataInicio') || undefined
    const dataFim = searchParams.get('dataFim') || undefined
    const numeroPedido = searchParams.get('numeroPedido') || undefined
    const nomeCliente = searchParams.get('nomeCliente') || undefined
    const parceiro = searchParams.get('parceiro') || undefined

    console.log('📋 Buscando pedidos do Oracle - userId:', userId, 'numeroPedido:', numeroPedido, 'parceiro:', parceiro)

    // Tentar obter usuário do cookie se userId não for fornecido
    let usuario

    if (userId) {
      // Buscar usuário diretamente do Oracle
      const userSql = `SELECT * FROM AD_USUARIOSVENDAS WHERE CODUSUARIO = :userId`
      const userResult = await oracleService.executeQuery(userSql, { userId: parseInt(userId) })
      
      if (userResult.length > 0) {
        usuario = userResult[0]
        console.log('✅ Usuário obtido do Oracle:', { id: usuario.CODUSUARIO, name: usuario.NOME })
      }
    } else {
      const cookieStore = cookies()
      const userCookie = cookieStore.get('user')

      if (userCookie?.value) {
        try {
          usuario = JSON.parse(userCookie.value)
          console.log('✅ Usuário obtido do cookie:', { id: usuario.id || usuario.ID, name: usuario.name || usuario.NAME })
        } catch (e) {
          console.error('Erro ao parsear cookie de usuário:', e)
        }
      }
    }

    if (!usuario) {
      console.error('❌ Usuário não autenticado - userId:', userId)
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const idEmpresa = usuario.ID_EMPRESA || usuario.id_empresa

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 })
    }

    console.log('👤 Tipo de usuário:', usuario.FUNCAO || usuario.TIPO || usuario.tipo || usuario.role)
    console.log('🔢 Código vendedor:', usuario.CODVEND || usuario.COD_VENDEDOR || usuario.codVendedor)

    const tipoUsuario = (usuario.FUNCAO || usuario.TIPO || usuario.tipo || usuario.role || '').toLowerCase()

    // Validar acesso ao parceiro se especificado
    if ((nomeCliente || parceiro) && tipoUsuario !== 'administrador') {
      const { accessControlService } = await import('@/lib/access-control-service')
      
      try {
        const userAccess = await accessControlService.validateUserAccess(
          usuario.CODUSUARIO || usuario.id || usuario.ID,
          idEmpresa
        )

        const parceirosFilter = accessControlService.getParceirosWhereClause(userAccess)
        
        let validacaoSql = `
          SELECT CODPARC, NOMEPARC
          FROM AS_PARCEIROS
          WHERE ID_SISTEMA = :idEmpresa
            AND SANKHYA_ATUAL = 'S'
            ${parceirosFilter.clause}
        `
        
        const validacaoBinds: any = {
          idEmpresa,
          ...parceirosFilter.binds
        }

        if (nomeCliente && nomeCliente.trim()) {
          validacaoSql += ` AND CODPARC = :codParc`
          validacaoBinds.codParc = nomeCliente.trim()
        } else if (parceiro && parceiro.trim()) {
          validacaoSql += ` AND UPPER(NOMEPARC) LIKE :nomeParceiro`
          validacaoBinds.nomeParceiro = `%${parceiro.toUpperCase()}%`
        }
        
        const parceirosValidos = await oracleService.executeQuery(validacaoSql, validacaoBinds)

        if (parceirosValidos.length === 0) {
          console.warn(`⚠️ [PEDIDOS] Parceiro não vinculado ao vendedor ${userAccess.codVendedor}`)
          
          const mensagemGerente = userAccess.vendedoresEquipe.length > 0 
            ? 'Este parceiro não está vinculado a você ou à sua equipe.'
            : 'Este parceiro não está vinculado ao seu usuário.';
          
          return NextResponse.json({
            error: 'Parceiro não vinculado',
            message: `${mensagemGerente} Você só pode visualizar pedidos de parceiros vinculados a você${userAccess.vendedoresEquipe.length > 0 ? ' ou sua equipe' : ''}.`,
            pedidos: []
          }, { status: 403 })
        }

        console.log(`✅ [PEDIDOS] ${parceirosValidos.length} parceiro(s) validado(s)`)
      } catch (error: any) {
        console.error('❌ Erro ao validar acesso:', error)
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    // Construir query dinâmica
    const criterios: string[] = [
      'c.ID_SISTEMA = :idEmpresa',
      'c.SANKHYA_ATUAL = \'S\'',
      'c.TIPMOV = \'P\''
    ]

    const binds: any = { idEmpresa }

    // Filtro por tipo de usuário
    const codVendedor = usuario.CODVEND || usuario.COD_VENDEDOR || usuario.codVendedor
    
    if (tipoUsuario === 'administrador') {
      console.log('🔓 Administrador - Listando todos os pedidos')
    } else if (tipoUsuario === 'gerente' && codVendedor) {
      console.log('👔 Gerente - Listando pedidos da equipe')
      // Buscar vendedores da equipe do gerente
      const vendedoresSql = `
        SELECT CODVEND 
        FROM AS_VENDEDORES 
        WHERE CODGER = :codGerente 
          AND ID_SISTEMA = :idEmpresa
          AND SANKHYA_ATUAL = 'S'
          AND ATIVO = 'S'
      `
      const vendedores = await oracleService.executeQuery(vendedoresSql, { 
        codGerente: codVendedor,
        idEmpresa 
      })
      const codVendedores = vendedores.map((v: any) => v.CODVEND)
      
      if (codVendedores.length > 0) {
        criterios.push(`c.CODVEND IN (${codVendedores.join(',')})`)
      } else {
        criterios.push('c.CODVEND = :codVendedor')
        binds.codVendedor = codVendedor
      }
    } else if (tipoUsuario === 'vendedor' && codVendedor) {
      console.log('💼 Vendedor - Listando pedidos próprios')
      criterios.push('c.CODVEND = :codVendedor')
      binds.codVendedor = codVendedor
    }

    // Filtros adicionais
    if (dataInicio) {
      criterios.push('c.DTNEG >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')')
      binds.dataInicio = dataInicio
    }

    if (dataFim) {
      criterios.push('c.DTNEG <= TO_DATE(:dataFim, \'YYYY-MM-DD\')')
      binds.dataFim = dataFim
    }

    if (numeroPedido && numeroPedido.trim()) {
      criterios.push('c.NUNOTA = :numeroPedido')
      binds.numeroPedido = numeroPedido.trim()
    }

    if (nomeCliente && nomeCliente.trim()) {
      criterios.push('c.CODPARC = :codParc')
      binds.codParc = nomeCliente.trim()
    }

    if (parceiro && parceiro.trim() && !nomeCliente) {
      criterios.push('p.NOMEPARC LIKE :nomeParceiro')
      binds.nomeParceiro = `%${parceiro}%`
    }

    const whereClause = criterios.join(' AND ')

    const sql = `
      SELECT 
        c.NUNOTA,
        c.CODPARC,
        p.NOMEPARC,
        c.CODVEND,
        c.VLRNOTA,
        TO_CHAR(c.DTNEG, 'DD/MM/YYYY') AS DTNEG,
        c.CODTIPOPER,
        c.CODTIPVENDA
      FROM AS_CABECALHO_NOTA c
      LEFT JOIN AS_PARCEIROS p ON c.CODPARC = p.CODPARC AND c.ID_SISTEMA = p.ID_SISTEMA
      WHERE ${whereClause}
      ORDER BY c.DTNEG DESC, c.NUNOTA DESC
    `

    const pedidos = await oracleService.executeQuery(sql, binds)

    console.log(`✅ ${pedidos.length} pedidos encontrados no Oracle`)

    return NextResponse.json(pedidos, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      }
    })
  } catch (error: any) {
    console.error('Erro ao listar pedidos:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao listar pedidos' },
      { status: 500 }
    )
  }
}

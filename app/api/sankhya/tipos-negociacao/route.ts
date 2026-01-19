
import { NextResponse } from 'next/server'
import { oracleService } from '@/lib/oracle-db'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const nunota = searchParams.get('nunota')

    // Obter ID da empresa do usuário logado
    const cookieStore = cookies()
    const userCookie = cookieStore.get('user')

    if (!userCookie) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const userData = JSON.parse(userCookie.value)
    const idEmpresa = userData.ID_EMPRESA

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 })
    }

    // Se passar NUNOTA, busca os dados do modelo
    if (nunota) {
      const sql = `
        SELECT 
          NUNOTA,
          CODTIPOPER,
          CODTIPVENDA
        FROM AS_CABECALHO_NOTA
        WHERE ID_SISTEMA = :idEmpresa
          AND NUNOTA = :nunota
          AND SANKHYA_ATUAL = 'S'
      `
      
      const resultado = await oracleService.executeOne(sql, { idEmpresa, nunota })
      
      if (!resultado) {
        return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
      }

      return NextResponse.json({
        codTipOper: resultado.CODTIPOPER,
        codTipVenda: resultado.CODTIPVENDA
      })
    }

    if (tipo === 'operacao') {
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
      
      const tiposOperacao = await oracleService.executeQuery(sql, { idEmpresa })
      return NextResponse.json({ tiposOperacao })
    }

    // Buscar tipos de negociação
    const sql = `
      SELECT 
        CODTIPVENDA,
        DESCRTIPVENDA
      FROM AS_TIPOS_NEGOCIACAO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY DESCRTIPVENDA
    `
    
    const tiposNegociacao = await oracleService.executeQuery(sql, { idEmpresa })
    return NextResponse.json({ tiposNegociacao })

  } catch (error: any) {
    console.error('Erro ao buscar tipos de negociação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar tipos de negociação' },
      { status: 500 }
    )
  }
}

// Endpoint para buscar por modelo
export async function POST(request: Request) {
  try {
    const { codTipOper } = await request.json()

    if (!codTipOper) {
      return NextResponse.json(
        { error: 'Modelo da nota é obrigatório' },
        { status: 400 }
      )
    }

    // Obter ID da empresa do usuário logado
    const cookieStore = cookies()
    const userCookie = cookieStore.get('user')

    if (!userCookie) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const userData = JSON.parse(userCookie.value)
    const idEmpresa = userData.ID_EMPRESA

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 })
    }

    const sql = `
      SELECT 
        NUNOTA,
        CODTIPOPER,
        CODTIPVENDA
      FROM AS_CABECALHO_NOTA
      WHERE ID_SISTEMA = :idEmpresa
        AND CODTIPOPER = :codTipOper
        AND TIPMOV = 'Z'
        AND SANKHYA_ATUAL = 'S'
      ORDER BY NUNOTA DESC
      FETCH FIRST 1 ROWS ONLY
    `

    const resultado = await oracleService.executeOne(sql, { idEmpresa, codTipOper })

    if (!resultado) {
      return NextResponse.json({
        codTipVenda: null,
        nunota: null
      })
    }

    return NextResponse.json({
      codTipVenda: resultado.CODTIPVENDA,
      nunota: resultado.NUNOTA
    })

  } catch (error: any) {
    console.error('Erro ao buscar CODTIPVENDA e NUNOTA por modelo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar dados do modelo' },
      { status: 500 }
    )
  }
}

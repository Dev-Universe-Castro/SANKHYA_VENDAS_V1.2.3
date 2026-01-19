import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { oracleService } from '@/lib/oracle-db'
import { accessControlService } from '@/lib/access-control-service'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get('user')
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    const idEmpresa = user.ID_EMPRESA || user.idEmpresa
    const userId = user.CODUSUARIO || user.id

    const userAccess = await accessControlService.validateUserAccess(userId, idEmpresa)
    const visitasFilter = accessControlService.getVisitasWhereClause(userAccess)

    const { searchParams } = new URL(request.url)
    const codRota = searchParams.get('codRota')
    const codParc = searchParams.get('codParc')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const status = searchParams.get('status')

    let conditions = [`v.ID_EMPRESA = :idEmpresa`]
    let binds: Record<string, any> = { idEmpresa, ...visitasFilter.binds }

    if (codRota) {
      conditions.push(`v.CODROTA = :codRota`)
      binds.codRota = parseInt(codRota)
    }
    if (codParc) {
      conditions.push(`v.CODPARC = :codParc`)
      binds.codParc = parseInt(codParc)
    }
    if (status) {
      conditions.push(`v.STATUS = :status`)
      binds.status = status
    }
    if (dataInicio) {
      conditions.push(`v.DATA_VISITA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`)
      binds.dataInicio = dataInicio
    }
    if (dataFim) {
      conditions.push(`v.DATA_VISITA <= TO_DATE(:dataFim, 'YYYY-MM-DD')`)
      binds.dataFim = dataFim
    }

    const sql = `
      SELECT 
        v.CODVISITA, v.ID_EMPRESA, v.CODROTA, v.CODPARC, v.CODVEND,
        TO_CHAR(v.DATA_VISITA, 'YYYY-MM-DD') AS DATA_VISITA,
        TO_CHAR(v.HORA_CHECKIN, 'YYYY-MM-DD"T"HH24:MI:SS') AS HORA_CHECKIN,
        TO_CHAR(v.HORA_CHECKOUT, 'YYYY-MM-DD"T"HH24:MI:SS') AS HORA_CHECKOUT,
        v.LAT_CHECKIN, v.LNG_CHECKIN, v.LAT_CHECKOUT, v.LNG_CHECKOUT,
        v.STATUS, v.OBSERVACAO, v.PEDIDO_GERADO, v.NUNOTA, v.VLRTOTAL,
        TO_CHAR(v.DTCAD, 'YYYY-MM-DD') AS DTCAD,
        p.NOMEPARC,
        vend.APELIDO AS NOMEVENDEDOR,
        r.DESCRICAO AS NOME_ROTA
      FROM AD_VISITAS v
      LEFT JOIN AS_PARCEIROS p ON v.CODPARC = p.CODPARC AND p.ID_SISTEMA = v.ID_EMPRESA AND p.SANKHYA_ATUAL = 'S'
      LEFT JOIN AS_VENDEDORES vend ON v.CODVEND = vend.CODVEND AND vend.ID_SISTEMA = v.ID_EMPRESA
      LEFT JOIN AD_ROTAS r ON v.CODROTA = r.CODROTA AND r.ID_EMPRESA = v.ID_EMPRESA
      WHERE ${conditions.join(' AND ')} ${visitasFilter.clause}
      ORDER BY v.DATA_VISITA DESC, v.HORA_CHECKIN DESC
    `

    const visitas = await oracleService.executeQuery<any>(sql, binds)

    for (const visita of visitas) {
      if (visita.HORA_CHECKIN && visita.HORA_CHECKOUT) {
        const checkin = new Date(visita.HORA_CHECKIN)
        const checkout = new Date(visita.HORA_CHECKOUT)
        visita.duracao = Math.round((checkout.getTime() - checkin.getTime()) / (1000 * 60))
      }
    }

    return NextResponse.json(visitas)
  } catch (error: any) {
    console.error('Erro ao buscar visitas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar visitas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get('user')
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    const idEmpresa = user.ID_EMPRESA || user.idEmpresa
    const userId = user.CODUSUARIO || user.id

    const userAccess = await accessControlService.validateUserAccess(userId, idEmpresa)
    
    if (!accessControlService.canCreateOrEdit(userAccess)) {
      return NextResponse.json({ error: accessControlService.getAccessDeniedMessage(userAccess) }, { status: 403 })
    }

    const body = await request.json()
    const { action, codVisita, codRota, codParc, latitude, longitude, observacao, pedidoGerado, nunota, vlrTotal } = body

    const codVend = userAccess.codVendedor

    if (action === 'checkin') {
      const insertSql = `
        INSERT INTO AD_VISITAS (
          ID_EMPRESA, CODROTA, CODPARC, CODVEND, DATA_VISITA,
          HORA_CHECKIN, LAT_CHECKIN, LNG_CHECKIN, STATUS, OBSERVACAO, PEDIDO_GERADO, DTCAD
        ) VALUES (
          :idEmpresa, :codRota, :codParc, :codVend, TRUNC(SYSDATE),
          SYSTIMESTAMP, :latitude, :longitude, 'CHECKIN', :observacao, 'N', SYSDATE
        )
      `

      await oracleService.executeQuery(insertSql, {
        idEmpresa,
        codRota: codRota || null,
        codParc,
        codVend,
        latitude: latitude || null,
        longitude: longitude || null,
        observacao: observacao || null
      })

      const lastVisitaSql = `
        SELECT CODVISITA FROM AD_VISITAS 
        WHERE ID_EMPRESA = :idEmpresa AND CODVEND = :codVend 
        ORDER BY CODVISITA DESC FETCH FIRST 1 ROWS ONLY
      `
      const lastVisita = await oracleService.executeOne<any>(lastVisitaSql, { idEmpresa, codVend })

      return NextResponse.json({ 
        success: true, 
        codVisita: lastVisita?.CODVISITA,
        message: 'Check-in realizado com sucesso'
      })
    }

    if (action === 'checkout') {
      if (!codVisita) {
        return NextResponse.json({ error: 'codVisita é obrigatório para checkout' }, { status: 400 })
      }

      const updateSql = `
        UPDATE AD_VISITAS
        SET HORA_CHECKOUT = SYSTIMESTAMP,
            LAT_CHECKOUT = :latitude,
            LNG_CHECKOUT = :longitude,
            STATUS = 'CONCLUIDA',
            OBSERVACAO = :observacao,
            PEDIDO_GERADO = :pedidoGerado,
            NUNOTA = :nunota,
            VLRTOTAL = :vlrTotal
        WHERE CODVISITA = :codVisita AND ID_EMPRESA = :idEmpresa
      `

      await oracleService.executeQuery(updateSql, {
        latitude: latitude || null,
        longitude: longitude || null,
        observacao: observacao || null,
        pedidoGerado: pedidoGerado ? 'S' : 'N',
        nunota: nunota || null,
        vlrTotal: vlrTotal || null,
        codVisita,
        idEmpresa
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Check-out realizado com sucesso'
      })
    }

    if (action === 'cancelar') {
      if (!codVisita) {
        return NextResponse.json({ error: 'codVisita é obrigatório' }, { status: 400 })
      }

      const updateSql = `
        UPDATE AD_VISITAS
        SET STATUS = 'CANCELADA', OBSERVACAO = :observacao
        WHERE CODVISITA = :codVisita AND ID_EMPRESA = :idEmpresa
      `

      await oracleService.executeQuery(updateSql, {
        observacao: observacao || 'Visita cancelada',
        codVisita,
        idEmpresa
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Visita cancelada'
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    console.error('Erro na operação de visita:', error)
    return NextResponse.json(
      { error: error.message || 'Erro na operação' },
      { status: 500 }
    )
  }
}

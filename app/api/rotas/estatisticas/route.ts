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
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    let conditions = [`v.ID_EMPRESA = :idEmpresa`]
    let binds: Record<string, any> = { idEmpresa, ...visitasFilter.binds }

    if (dataInicio) {
      conditions.push(`v.DATA_VISITA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`)
      binds.dataInicio = dataInicio
    }
    if (dataFim) {
      conditions.push(`v.DATA_VISITA <= TO_DATE(:dataFim, 'YYYY-MM-DD')`)
      binds.dataFim = dataFim
    }

    const whereClause = `${conditions.join(' AND ')} ${visitasFilter.clause}`

    const sql = `
      SELECT 
        v.CODVISITA, v.CODROTA, v.CODPARC, v.CODVEND,
        TO_CHAR(v.DATA_VISITA, 'YYYY-MM-DD') AS DATA_VISITA,
        v.HORA_CHECKIN, v.HORA_CHECKOUT, v.STATUS,
        v.PEDIDO_GERADO, v.NUNOTA, v.VLRTOTAL
      FROM AD_VISITAS v
      WHERE ${whereClause}
    `

    const visitas = await oracleService.executeQuery<any>(sql, binds)

    const totalVisitas = visitas.length
    const visitasConcluidas = visitas.filter((v: any) => v.STATUS === 'CONCLUIDA').length
    const visitasCanceladas = visitas.filter((v: any) => v.STATUS === 'CANCELADA').length
    const visitasEmAndamento = visitas.filter((v: any) => v.STATUS === 'CHECKIN').length
    const pedidosGerados = visitas.filter((v: any) => v.PEDIDO_GERADO === 'S').length
    
    const valorTotalPedidos = visitas
      .filter((v: any) => v.PEDIDO_GERADO === 'S' && v.VLRTOTAL)
      .reduce((sum: number, v: any) => sum + parseFloat(v.VLRTOTAL || 0), 0)

    const visitasComTempo = visitas.filter((v: any) => v.HORA_CHECKIN && v.HORA_CHECKOUT)
    const tempoTotal = visitasComTempo.reduce((sum: number, v: any) => {
      const checkin = new Date(v.HORA_CHECKIN)
      const checkout = new Date(v.HORA_CHECKOUT)
      return sum + (checkout.getTime() - checkin.getTime()) / (1000 * 60)
    }, 0)
    const tempoMedioVisita = visitasComTempo.length > 0 ? Math.round(tempoTotal / visitasComTempo.length) : 0

    const visitasPorDia: Record<string, number> = {}
    visitas.forEach((v: any) => {
      const dia = v.DATA_VISITA
      visitasPorDia[dia] = (visitasPorDia[dia] || 0) + 1
    })

    const visitasPorStatus = {
      pendente: visitas.filter((v: any) => v.STATUS === 'PENDENTE').length,
      checkin: visitasEmAndamento,
      concluida: visitasConcluidas,
      cancelada: visitasCanceladas
    }

    const topParceiros: Record<number, { codParc: number; visitas: number; pedidos: number; valor: number }> = {}
    visitas.forEach((v: any) => {
      if (!topParceiros[v.CODPARC]) {
        topParceiros[v.CODPARC] = { codParc: v.CODPARC, visitas: 0, pedidos: 0, valor: 0 }
      }
      topParceiros[v.CODPARC].visitas++
      if (v.PEDIDO_GERADO === 'S') {
        topParceiros[v.CODPARC].pedidos++
        topParceiros[v.CODPARC].valor += parseFloat(v.VLRTOTAL || 0)
      }
    })

    const topParceirosArray = Object.values(topParceiros)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)

    for (const p of topParceirosArray) {
      const parcSql = `
        SELECT NOMEPARC FROM AS_PARCEIROS 
        WHERE CODPARC = :codParc AND ID_SISTEMA = :idEmpresa AND SANKHYA_ATUAL = 'S'
      `
      const parc = await oracleService.executeOne<any>(parcSql, { codParc: p.codParc, idEmpresa })
      if (parc) {
        (p as any).nomeParc = parc.NOMEPARC
      }
    }

    return NextResponse.json({
      totalVisitas,
      visitasConcluidas,
      visitasCanceladas,
      visitasEmAndamento,
      pedidosGerados,
      valorTotalPedidos,
      tempoMedioVisita,
      taxaConversao: totalVisitas > 0 ? Math.round((pedidosGerados / totalVisitas) * 100) : 0,
      taxaConclusao: totalVisitas > 0 ? Math.round((visitasConcluidas / totalVisitas) * 100) : 0,
      visitasPorDia: Object.entries(visitasPorDia).map(([data, count]) => ({ data, count })),
      visitasPorStatus,
      topParceiros: topParceirosArray
    })
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}

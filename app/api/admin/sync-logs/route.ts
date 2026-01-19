
import { NextRequest, NextResponse } from 'next/server'
import { syncLogsService } from '@/lib/sync-logs-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const idEmpresa = parseInt(searchParams.get('idEmpresa') || '0')

    if (!idEmpresa) {
      return NextResponse.json(
        { error: 'idEmpresa é obrigatório' },
        { status: 400 }
      )
    }

    const filtros: any = {}

    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    if (dataInicio) filtros.dataInicio = new Date(dataInicio)
    if (dataFim) filtros.dataFim = new Date(dataFim)
    if (status) filtros.status = status
    if (userId) filtros.userId = parseInt(userId)

    const logs = await syncLogsService.buscarLogs(idEmpresa, filtros)

    return NextResponse.json({ success: true, logs })
  } catch (error: any) {
    console.error('❌ Erro ao buscar logs:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar logs', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      idEmpresa,
      userId,
      userName,
      tipoOperacao,
      status,
      dadosEnviados,
      resposta,
      erro,
      numeroDocumento
    } = body

    if (!idEmpresa || !userId || !userName || !tipoOperacao || !status) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    await syncLogsService.registrarLog({
      idEmpresa,
      userId,
      userName,
      tipoOperacao,
      status,
      dadosEnviados,
      resposta,
      erro,
      numeroDocumento,
      dataHora: new Date()
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Erro ao criar log:', error)
    return NextResponse.json(
      { error: 'Erro ao criar log', details: error.message },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { contratosService } from '@/lib/contratos-service'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get('user')

    if (!userCookie) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let user
    try {
      // O cookie já vem decodificado automaticamente pelo Next.js
      user = JSON.parse(userCookie.value)
    } catch (parseError) {
      console.error('Erro ao fazer parse do cookie:', parseError)
      return NextResponse.json({ error: 'Cookie inválido' }, { status: 401 })
    }

    const role = user.role || user.FUNCAO || ''
    
    const isAdmin = role === 'Administrador' || role === 'ADMIN'
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem visualizar credenciais.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const idEmpresa = parseInt(searchParams.get('idEmpresa') || '0')

    if (!idEmpresa) {
      return NextResponse.json({ error: 'ID da empresa não informado' }, { status: 400 })
    }

    const contrato = await contratosService.getContratoByEmpresa(idEmpresa)

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado para esta empresa' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      contrato: {
        EMPRESA: contrato.EMPRESA,
        IS_SANDBOX: contrato.IS_SANDBOX,
        AUTH_TYPE: contrato.AUTH_TYPE || 'LEGACY',
        SANKHYA_TOKEN: contrato.SANKHYA_TOKEN,
        SANKHYA_APPKEY: contrato.SANKHYA_APPKEY,
        SANKHYA_USERNAME: contrato.SANKHYA_USERNAME,
        SANKHYA_PASSWORD: contrato.SANKHYA_PASSWORD,
        OAUTH_CLIENT_ID: contrato.OAUTH_CLIENT_ID || '',
        OAUTH_CLIENT_SECRET: contrato.OAUTH_CLIENT_SECRET || '',
        OAUTH_X_TOKEN: contrato.OAUTH_X_TOKEN || '',
        GEMINI_API_KEY: contrato.GEMINI_API_KEY || '',
        ATIVO: contrato.ATIVO
      }
    })
  } catch (error: any) {
    console.error('❌ Erro ao buscar credenciais:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar credenciais da empresa' },
      { status: 500 }
    )
  }
}

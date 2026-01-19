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
    const rotasFilter = accessControlService.getRotasWhereClause(userAccess)

    const { searchParams } = new URL(request.url)
    const codRota = searchParams.get('codRota')

    let sql: string
    let binds: Record<string, any> = { idEmpresa, ...rotasFilter.binds }

    if (codRota) {
      sql = `
        SELECT 
          r.CODROTA, r.ID_EMPRESA, r.DESCRICAO, r.CODVEND, r.TIPO_RECORRENCIA,
          r.DIAS_SEMANA, r.INTERVALO_DIAS, r.DATA_INICIO, r.DATA_FIM, r.ATIVO, r.DTCAD,
          v.APELIDO AS NOMEVENDEDOR
        FROM AD_ROTAS r
        LEFT JOIN AS_VENDEDORES v ON r.CODVEND = v.CODVEND AND v.ID_SISTEMA = r.ID_EMPRESA
        WHERE r.CODROTA = :codRota AND r.ID_EMPRESA = :idEmpresa ${rotasFilter.clause}
      `
      binds.codRota = parseInt(codRota)
    } else {
      sql = `
        SELECT 
          r.CODROTA, r.ID_EMPRESA, r.DESCRICAO, r.CODVEND, r.TIPO_RECORRENCIA,
          r.DIAS_SEMANA, r.INTERVALO_DIAS, r.DATA_INICIO, r.DATA_FIM, r.ATIVO, r.DTCAD,
          v.APELIDO AS NOMEVENDEDOR
        FROM AD_ROTAS r
        LEFT JOIN AS_VENDEDORES v ON r.CODVEND = v.CODVEND AND v.ID_SISTEMA = r.ID_EMPRESA
        WHERE r.ID_EMPRESA = :idEmpresa AND r.ATIVO = 'S' ${rotasFilter.clause}
        ORDER BY r.DESCRICAO
      `
    }

    const rotas = await oracleService.executeQuery<any>(sql, binds)

    for (const rota of rotas) {
      const parceirosSql = `
        SELECT 
          rp.CODROTAPARC, rp.CODROTA, rp.CODPARC, rp.ORDEM,
          rp.LATITUDE, rp.LONGITUDE, rp.TEMPO_ESTIMADO,
          p.NOMEPARC, p.ENDERECO, p.CIDADE, p.UF
        FROM AD_ROTA_PARCEIROS rp
        INNER JOIN AD_ROTAS rot ON rp.CODROTA = rot.CODROTA AND rot.ID_EMPRESA = :idEmpresa
        LEFT JOIN AS_PARCEIROS p ON rp.CODPARC = p.CODPARC AND p.ID_SISTEMA = :idEmpresa AND p.SANKHYA_ATUAL = 'S'
        WHERE rp.CODROTA = :codRota
        ORDER BY rp.ORDEM
      `
      rota.parceiros = await oracleService.executeQuery<any>(parceirosSql, { idEmpresa, codRota: rota.CODROTA })
    }

    return NextResponse.json(codRota ? rotas[0] || null : rotas)
  } catch (error: any) {
    console.error('Erro ao buscar rotas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar rotas' },
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
    const { descricao, codVend, tipoRecorrencia, diasSemana, intervaloDias, dataInicio, dataFim, parceiros } = body

    const codVendFinal = codVend || userAccess.codVendedor

    const insertSql = `
      INSERT INTO AD_ROTAS (ID_EMPRESA, DESCRICAO, CODVEND, TIPO_RECORRENCIA, DIAS_SEMANA, INTERVALO_DIAS, DATA_INICIO, DATA_FIM, ATIVO, DTCAD)
      VALUES (:idEmpresa, :descricao, :codVend, :tipoRecorrencia, :diasSemana, :intervaloDias, TO_DATE(:dataInicio, 'YYYY-MM-DD'), TO_DATE(:dataFim, 'YYYY-MM-DD'), 'S', SYSDATE)
    `

    await oracleService.executeQuery(insertSql, {
      idEmpresa,
      descricao,
      codVend: codVendFinal,
      tipoRecorrencia,
      diasSemana: diasSemana || null,
      intervaloDias: intervaloDias || null,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null
    })

    const lastRotaSql = `
      SELECT CODROTA FROM AD_ROTAS 
      WHERE ID_EMPRESA = :idEmpresa AND CODVEND = :codVend 
      ORDER BY CODROTA DESC FETCH FIRST 1 ROWS ONLY
    `
    const lastRota = await oracleService.executeOne<any>(lastRotaSql, { idEmpresa, codVend: codVendFinal })
    const codRota = lastRota?.CODROTA

    if (codRota && parceiros && parceiros.length > 0) {
      for (const parceiro of parceiros) {
        const insertParcSql = `
          INSERT INTO AD_ROTA_PARCEIROS (CODROTA, CODPARC, ORDEM, LATITUDE, LONGITUDE, TEMPO_ESTIMADO)
          VALUES (:codRota, :codParc, :ordem, :latitude, :longitude, :tempoEstimado)
        `
        await oracleService.executeQuery(insertParcSql, {
          codRota,
          codParc: parceiro.codParc,
          ordem: parceiro.ordem,
          latitude: parceiro.latitude || null,
          longitude: parceiro.longitude || null,
          tempoEstimado: parceiro.tempoEstimado || null
        })
      }
    }

    return NextResponse.json({ success: true, codRota })
  } catch (error: any) {
    console.error('Erro ao criar rota:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar rota' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const { codRota, descricao, codVend, tipoRecorrencia, diasSemana, intervaloDias, dataInicio, dataFim, ativo, parceiros } = body

    const updateSql = `
      UPDATE AD_ROTAS
      SET DESCRICAO = :descricao,
          CODVEND = :codVend,
          TIPO_RECORRENCIA = :tipoRecorrencia,
          DIAS_SEMANA = :diasSemana,
          INTERVALO_DIAS = :intervaloDias,
          DATA_INICIO = TO_DATE(:dataInicio, 'YYYY-MM-DD'),
          DATA_FIM = TO_DATE(:dataFim, 'YYYY-MM-DD'),
          ATIVO = :ativo,
          DTALTER = SYSDATE
      WHERE CODROTA = :codRota AND ID_EMPRESA = :idEmpresa
    `

    await oracleService.executeQuery(updateSql, {
      descricao,
      codVend,
      tipoRecorrencia,
      diasSemana: diasSemana || null,
      intervaloDias: intervaloDias || null,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      ativo: ativo || 'S',
      codRota,
      idEmpresa
    })

    if (parceiros !== undefined) {
      const deleteParcs = `DELETE FROM AD_ROTA_PARCEIROS WHERE CODROTA = :codRota`
      await oracleService.executeQuery(deleteParcs, { codRota })

      for (const parceiro of parceiros) {
        const insertParcSql = `
          INSERT INTO AD_ROTA_PARCEIROS (CODROTA, CODPARC, ORDEM, LATITUDE, LONGITUDE, TEMPO_ESTIMADO)
          VALUES (:codRota, :codParc, :ordem, :latitude, :longitude, :tempoEstimado)
        `
        await oracleService.executeQuery(insertParcSql, {
          codRota,
          codParc: parceiro.codParc,
          ordem: parceiro.ordem,
          latitude: parceiro.latitude || null,
          longitude: parceiro.longitude || null,
          tempoEstimado: parceiro.tempoEstimado || null
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao atualizar rota:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar rota' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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
    
    if (!userAccess.isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem excluir rotas' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const codRota = searchParams.get('codRota')

    if (!codRota) {
      return NextResponse.json({ error: 'codRota é obrigatório' }, { status: 400 })
    }

    const deleteSql = `
      UPDATE AD_ROTAS
      SET ATIVO = 'N', DTALTER = SYSDATE
      WHERE CODROTA = :codRota AND ID_EMPRESA = :idEmpresa
    `

    await oracleService.executeQuery(deleteSql, { codRota: parseInt(codRota), idEmpresa })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao excluir rota:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir rota' },
      { status: 500 }
    )
  }
}

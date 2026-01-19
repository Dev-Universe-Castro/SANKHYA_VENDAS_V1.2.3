"use server"

import { NextRequest, NextResponse } from 'next/server'
import { oracleService } from '@/lib/oracle-db'
import { cookies } from 'next/headers'

function getUserFromCookie() {
  try {
    const userCookie = cookies().get('user')?.value
    if (!userCookie) return null
    return JSON.parse(decodeURIComponent(userCookie))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromCookie()
    if (!user || (user.role !== 'Administrador' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const idEmpresa = user.ID_EMPRESA

    if (action === 'definitions') {
      const sql = `
        SELECT 
          ID,
          PERMISSION_KEY,
          CATEGORY,
          DESCRIPTION,
          DEFAULT_ADMIN,
          DEFAULT_GERENTE,
          DEFAULT_VENDEDOR
        FROM AD_ACL_PERMISSION_DEFS
        ORDER BY CATEGORY, PERMISSION_KEY
      `
      const definitions = await oracleService.executeQuery<any>(sql, {})
      return NextResponse.json({ definitions })
    }

    if (action === 'users') {
      const sql = `
        SELECT 
          u.CODUSUARIO,
          u.NOME,
          u.EMAIL,
          u.FUNCAO,
          u.CODVEND,
          v.APELIDO as NOME_VENDEDOR,
          v.TIPVEND
        FROM AD_USUARIOSVENDAS u
        LEFT JOIN AS_VENDEDORES v ON u.CODVEND = v.CODVEND AND v.ID_SISTEMA = u.ID_EMPRESA
        WHERE u.ID_EMPRESA = :idEmpresa
          AND u.ATIVO = 'S'
        ORDER BY u.NOME
      `
      const users = await oracleService.executeQuery<any>(sql, { idEmpresa })
      return NextResponse.json({ users })
    }

    if (action === 'userPermissions' && userId) {
      const sql = `
        SELECT 
          r.ID,
          r.PERMISSION_KEY,
          r.ALLOWED,
          r.DATA_SCOPE,
          r.CUSTOM_VENDORS,
          d.CATEGORY,
          d.DESCRIPTION
        FROM AD_ACL_USER_RULES r
        JOIN AD_ACL_PERMISSION_DEFS d ON r.PERMISSION_KEY = d.PERMISSION_KEY
        WHERE r.CODUSUARIO = :userId
          AND r.ID_EMPRESA = :idEmpresa
      `
      const permissions = await oracleService.executeQuery<any>(sql, { 
        userId: Number(userId), 
        idEmpresa 
      })

      const userSql = `
        SELECT FUNCAO FROM AD_USUARIOSVENDAS 
        WHERE CODUSUARIO = :userId AND ID_EMPRESA = :idEmpresa
      `
      const userInfo = await oracleService.executeOne<any>(userSql, { 
        userId: Number(userId), 
        idEmpresa 
      })

      return NextResponse.json({ 
        permissions, 
        userRole: userInfo?.FUNCAO || 'Vendedor' 
      })
    }

    return NextResponse.json({ error: 'Ação não especificada' }, { status: 400 })
  } catch (error: any) {
    console.error('Erro na API de acessos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromCookie()
    if (!user || (user.role !== 'Administrador' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, permissions } = body
    const idEmpresa = user.ID_EMPRESA
    const adminId = user.id

    if (!userId || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    for (const perm of permissions) {
      const { permissionKey, allowed, dataScope, customVendors } = perm

      const existsSql = `
        SELECT ID FROM AD_ACL_USER_RULES 
        WHERE CODUSUARIO = :userId 
          AND ID_EMPRESA = :idEmpresa 
          AND PERMISSION_KEY = :permissionKey
      `
      const existing = await oracleService.executeOne<any>(existsSql, {
        userId,
        idEmpresa,
        permissionKey
      })

      if (existing) {
        const updateSql = `
          UPDATE AD_ACL_USER_RULES 
          SET ALLOWED = :allowed,
              DATA_SCOPE = :dataScope,
              CUSTOM_VENDORS = :customVendors,
              UPDATED_AT = SYSTIMESTAMP,
              UPDATED_BY = :adminId
          WHERE ID = :id
        `
        await oracleService.executeQuery(updateSql, {
          allowed: allowed ? 'S' : 'N',
          dataScope: dataScope || null,
          customVendors: customVendors ? JSON.stringify(customVendors) : null,
          adminId,
          id: existing.ID
        })
      } else {
        const insertSql = `
          INSERT INTO AD_ACL_USER_RULES (
            CODUSUARIO, ID_EMPRESA, PERMISSION_KEY, ALLOWED, 
            DATA_SCOPE, CUSTOM_VENDORS, UPDATED_BY
          ) VALUES (
            :userId, :idEmpresa, :permissionKey, :allowed,
            :dataScope, :customVendors, :adminId
          )
        `
        await oracleService.executeQuery(insertSql, {
          userId,
          idEmpresa,
          permissionKey,
          allowed: allowed ? 'S' : 'N',
          dataScope: dataScope || null,
          customVendors: customVendors ? JSON.stringify(customVendors) : null,
          adminId
        })
      }
    }

    return NextResponse.json({ success: true, message: 'Permissões atualizadas com sucesso' })
  } catch (error: any) {
    console.error('Erro ao salvar permissões:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromCookie()
    if (!user || (user.role !== 'Administrador' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const permissionKey = searchParams.get('permissionKey')
    const idEmpresa = user.ID_EMPRESA

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }

    if (permissionKey) {
      const sql = `
        DELETE FROM AD_ACL_USER_RULES 
        WHERE CODUSUARIO = :userId 
          AND ID_EMPRESA = :idEmpresa 
          AND PERMISSION_KEY = :permissionKey
      `
      await oracleService.executeQuery(sql, { userId, idEmpresa, permissionKey })
    } else {
      const sql = `
        DELETE FROM AD_ACL_USER_RULES 
        WHERE CODUSUARIO = :userId 
          AND ID_EMPRESA = :idEmpresa
      `
      await oracleService.executeQuery(sql, { userId, idEmpresa })
    }

    return NextResponse.json({ success: true, message: 'Permissões removidas' })
  } catch (error: any) {
    console.error('Erro ao deletar permissões:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

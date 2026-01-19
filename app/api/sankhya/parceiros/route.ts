import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { oracleService } from '@/lib/oracle-db';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies(); // Acessa os cookies do servidor
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA;

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    console.log('👤 Usuário:', { id: user.id, name: user.name, role: user.role, idEmpresa: idEmpresa });

    // Validar acesso do usuário
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      // Chama a validação de acesso do usuário
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      // Obtém os parâmetros de busca e paginação da URL
      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search') || '';
      const searchCode = searchParams.get('searchCode') || '';
      const searchName = searchParams.get('searchName') || '';
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');

      // Aplica o filtro de acesso específico para parceiros
      const accessFilter = accessControlService.getParceirosWhereClause(userAccess);
      const pageSize = parseInt(searchParams.get('pageSize') || '50');

      // Se buscando por código ou nome específico, validar se o vendedor tem acesso
      if ((searchCode || searchName) && !userAccess.isAdmin) {
        let validacaoSql = `
          SELECT CODPARC, NOMEPARC
          FROM AS_PARCEIROS
          WHERE ID_SISTEMA = :idEmpresa
            AND SANKHYA_ATUAL = 'S'
            AND CLIENTE = 'S'
        `;
        
        const validacaoBinds: any = { idEmpresa };

        // Aplicar filtro de acesso
        if (accessFilter.clause) {
          validacaoSql += ` ${accessFilter.clause}`;
          Object.assign(validacaoBinds, accessFilter.binds);
        }

        if (searchCode && searchCode.trim()) {
          validacaoSql += ` AND CODPARC = :searchCode`;
          validacaoBinds.searchCode = searchCode.trim();
        } else if (searchName && searchName.trim()) {
          validacaoSql += ` AND (UPPER(NOMEPARC) LIKE :searchName OR UPPER(RAZAOSOCIAL) LIKE :searchName)`;
          validacaoBinds.searchName = `%${searchName.toUpperCase()}%`;
        }
        
        const parceirosValidos = await oracleService.executeQuery(validacaoSql, validacaoBinds);

        if (parceirosValidos.length === 0) {
          console.warn(`⚠️ [PARCEIROS] Parceiro não vinculado ao vendedor ${userAccess.codVendedor}`);
          return NextResponse.json({
            error: 'Parceiro não vinculado',
            message: 'Este parceiro não está vinculado ao seu usuário. Você só pode visualizar parceiros vinculados a você ou sua equipe.',
            parceiros: [],
            total: 0,
            page: page,
            pageSize: pageSize,
            totalPages: 0
          }, { status: 403 });
        }

        console.log(`✅ [PARCEIROS] ${parceirosValidos.length} parceiro(s) validado(s)`);
      }

      // Construir critérios de busca
      const criterios: string[] = [
        'ID_SISTEMA = :idEmpresa',
        'SANKHYA_ATUAL = \'S\'',
        'CLIENTE = \'S\''
      ];

      const binds: any = { idEmpresa };

      // Aplicar filtro de acesso
      if (accessFilter.clause) {
        criterios.push(accessFilter.clause.replace('AND ', ''));
        Object.assign(binds, accessFilter.binds);
      }

      // Filtros de busca adicionais
      if (searchName && searchName.trim()) {
        criterios.push('(UPPER(NOMEPARC) LIKE :searchName OR UPPER(RAZAOSOCIAL) LIKE :searchName)');
        binds.searchName = `%${searchName.toUpperCase()}%`;
      }

      if (searchCode && searchCode.trim()) {
        criterios.push('CODPARC = :searchCode');
        binds.searchCode = searchCode.trim();
      }

      const whereClause = criterios.join(' AND ');
      const offset = (page - 1) * pageSize;

      const sql = `
        SELECT
          CODPARC,
          NOMEPARC,
          RAZAOSOCIAL,
          CGC_CPF,
          IDENTINSCESTAD,
          CLIENTE,
          ATIVO,
          CODCID,
          CODVEND,
          TIPPESSOA,
          CODTAB
        FROM AS_PARCEIROS
        WHERE ${whereClause}
        ORDER BY NOMEPARC
        OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY
      `;

      binds.offset = offset;
      binds.pageSize = pageSize;

      const parceiros = await oracleService.executeQuery(sql, binds);

      // Contar total - criar binds separados SEM offset e pageSize
      const countBinds = { ...binds };
      delete countBinds.offset;
      delete countBinds.pageSize;
      
      const countSql = `SELECT COUNT(*) as TOTAL FROM AS_PARCEIROS WHERE ${whereClause}`;
      const countResult = await oracleService.executeOne(countSql, countBinds);
      const total = parseInt(countResult?.TOTAL || '0');

      console.log(`✅ ${parceiros.length} parceiros encontrados no Oracle`);

      const result = {
        parceiros,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

      return NextResponse.json(result);

    } catch (accessError: any) {
      console.error('❌ Erro de acesso:', accessError.message);
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }
  } catch (error: any) {
    console.error('❌ Erro ao buscar parceiros:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
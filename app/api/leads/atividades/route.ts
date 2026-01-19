
import { NextResponse } from 'next/server';
import { consultarAtividades } from '@/lib/oracle-leads-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codLead = searchParams.get('codLead') || '';
    const idEmpresa = 1; // ID_EMPRESA fixo
    const ativo = searchParams.get('ativo') || 'S';
    const codUsuario = searchParams.get('codUsuario');

    console.log('📥 Consultando atividades', codLead ? `para lead: ${codLead}` : 'de todos os leads', codUsuario ? `para usuário: ${codUsuario}` : '');
    
    // Importar serviços necessários
    const { cookies } = await import('next/headers');
    const { accessControlService } = await import('@/lib/access-control-service');

    // Obter usuário do cookie
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');
    
    let usuarioLogado;
    if (userCookie?.value) {
      try {
        usuarioLogado = JSON.parse(userCookie.value);
        console.log('✅ Usuário obtido do cookie:', { id: usuarioLogado.id, name: usuarioLogado.name, role: usuarioLogado.role });
      } catch (e) {
        console.error('❌ Erro ao parsear cookie de usuário:', e);
        return NextResponse.json({ error: 'Cookie de usuário inválido' }, { status: 401 });
      }
    }

    // Se não tiver usuário no cookie e não passou codUsuario, retornar erro
    if (!usuarioLogado && !codUsuario) {
      console.error('❌ Usuário não autenticado - sem cookie e sem codUsuario');
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // Usar o ID do usuário do cookie ou do parâmetro
    const userId = usuarioLogado?.id || parseInt(codUsuario || '0');
    
    if (!userId || userId === 0) {
      console.error('❌ ID de usuário inválido:', { usuarioLogado, codUsuario });
      return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 });
    }

    console.log('🔍 Validando acesso para userId:', userId, 'empresa:', idEmpresa);

    // Se for admin pelo cookie, permitir acesso total sem validação no banco
    const isAdminByCookie = usuarioLogado?.role === 'Administrador' || usuarioLogado?.role === 'ADMIN';
    
    // Validar acesso do usuário
    let userAccess;
    if (isAdminByCookie) {
      console.log('🔓 Administrador detectado no cookie - permitindo acesso total');
      userAccess = {
        userId,
        idEmpresa,
        role: usuarioLogado.role,
        codVendedor: null,
        codGerente: null,
        isAdmin: true,
        vendedoresEquipe: []
      };
    } else {
      try {
        userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);
        console.log('🔐 Acesso validado:', { 
          userId: userAccess.userId, 
          isAdmin: userAccess.isAdmin, 
          codVendedor: userAccess.codVendedor,
          vendedoresEquipe: userAccess.vendedoresEquipe 
        });
      } catch (error: any) {
        console.error('❌ Erro ao validar acesso do usuário:', error.message);
        return NextResponse.json({ 
          error: 'Erro ao validar permissões do usuário', 
          details: error.message 
        }, { status: 403 });
      }
    }

    // Determinar filtro de usuários baseado no perfil
    let filtroUsuarios: number[] = [];

    if (userAccess.isAdmin) {
      // Admin vê tudo - sem filtro
      console.log('🔓 Administrador - Listando todas as atividades');
    } else if (userAccess.vendedoresEquipe && userAccess.vendedoresEquipe.length > 0) {
      // Gerente vê suas atividades + atividades dos vendedores da equipe
      console.log('👔 Gerente - Listando atividades da equipe');
      
      // Buscar CODUSUARIO de todos os vendedores da equipe
      const { oracleService } = await import('@/lib/oracle-db');
      const vendedoresEquipe = [userAccess.codVendedor, ...userAccess.vendedoresEquipe];
      
      const usuariosSql = `
        SELECT CODUSUARIO 
        FROM AD_USUARIOSVENDAS 
        WHERE CODVEND IN (${vendedoresEquipe.join(',')})
          AND ID_EMPRESA = :idEmpresa
          AND STATUS = 'ativo'
      `;
      
      const usuarios = await oracleService.executeQuery(usuariosSql, { idEmpresa });
      filtroUsuarios = usuarios.map((u: any) => u.CODUSUARIO);
      
      console.log(`✅ Gerente pode ver atividades de ${filtroUsuarios.length} usuários:`, filtroUsuarios);
    } else {
      // Vendedor comum vê apenas suas próprias atividades
      console.log('💼 Vendedor - Listando apenas atividades próprias');
      filtroUsuarios = [userAccess.userId];
    }

    // Passar filtro de usuários para a consulta
    console.log('🔍 Filtros aplicados:', { 
      codLead, 
      isAdmin: userAccess.isAdmin, 
      filtroUsuarios 
    });

    // Se passou codUsuario específico, usar ele; caso contrário, usar filtroUsuarios da equipe
    const atividades = await consultarAtividades(
      codLead, 
      idEmpresa, 
      ativo, 
      undefined, // Não passar codUsuario individual quando for gerente
      filtroUsuarios.length > 0 ? filtroUsuarios : (codUsuario ? [parseInt(codUsuario)] : undefined)
    );
    
    console.log(`✅ ${atividades.length} atividades consultadas do Oracle`);
    
    // Serializar manualmente para evitar referências circulares
    const atividadesSerializadas = atividades.map(atividade => ({
      CODATIVIDADE: atividade.CODATIVIDADE,
      CODLEAD: atividade.CODLEAD,
      TIPO: atividade.TIPO,
      TITULO: atividade.TITULO,
      DESCRICAO: atividade.DESCRICAO,
      DATA_HORA: atividade.DATA_HORA,
      DATA_INICIO: atividade.DATA_INICIO,
      DATA_FIM: atividade.DATA_FIM,
      CODUSUARIO: atividade.CODUSUARIO,
      DADOS_COMPLEMENTARES: atividade.DADOS_COMPLEMENTARES,
      NOME_USUARIO: atividade.NOME_USUARIO,
      COR: atividade.COR,
      ORDEM: atividade.ORDEM,
      ATIVO: atividade.ATIVO,
      STATUS: atividade.STATUS
    }));
    
    console.log(`📤 Retornando ${atividadesSerializadas.length} atividades serializadas`);
    return NextResponse.json(atividadesSerializadas);
    
  } catch (error: any) {
    console.error('❌ Erro ao consultar atividades:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Erro ao consultar atividades',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

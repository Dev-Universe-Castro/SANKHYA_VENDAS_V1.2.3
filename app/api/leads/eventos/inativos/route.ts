
import { NextResponse } from 'next/server';
import { consultarAtividades } from '@/lib/oracle-leads-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codLead = searchParams.get('codLead') || '';
    const idEmpresa = 1;
    const codUsuario = searchParams.get('codUsuario');

    console.log('📥 Consultando eventos inativos', codUsuario ? `para usuário: ${codUsuario}` : '');

    const atividades = await consultarAtividades(codLead, idEmpresa, 'N', codUsuario ? parseInt(codUsuario) : undefined);

    const atividadesSerializadas = atividades.map(atividade => {
      return JSON.parse(JSON.stringify({
        CODATIVIDADE: String(atividade.CODATIVIDADE || ''),
        CODLEAD: String(atividade.CODLEAD || ''),
        TIPO: String(atividade.TIPO || ''),
        TITULO: String(atividade.TITULO || ''),
        DESCRICAO: String(atividade.DESCRICAO || ''),
        DATA_HORA: String(atividade.DATA_HORA || ''),
        DATA_INICIO: String(atividade.DATA_INICIO || ''),
        DATA_FIM: String(atividade.DATA_FIM || ''),
        CODUSUARIO: atividade.CODUSUARIO ? Number(atividade.CODUSUARIO) : 0,
        DADOS_COMPLEMENTARES: String(atividade.DADOS_COMPLEMENTARES || ''),
        NOME_USUARIO: String(atividade.NOME_USUARIO || ''),
        COR: String(atividade.COR || '#22C55E'),
        ORDEM: atividade.ORDEM ? Number(atividade.ORDEM) : 0,
        ATIVO: String(atividade.ATIVO || 'N'),
        STATUS: String(atividade.STATUS || 'AGUARDANDO')
      }));
    });

    console.log(`📤 Retornando ${atividadesSerializadas.length} eventos inativos`);
    return new Response(JSON.stringify(atividadesSerializadas), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar eventos inativos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar eventos inativos' },
      { status: 500 }
    );
  }
}

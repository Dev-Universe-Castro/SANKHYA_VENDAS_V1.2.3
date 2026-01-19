import { NextResponse } from 'next/server';
import { oracleService } from '@/lib/oracle-db';

export async function POST(request: Request) {
  try {
    const { codLead, status, motivoPerda } = await request.json();

    console.log('🔄 [API Status] Atualizando status do lead via Oracle:', { codLead, status, motivoPerda });

    if (!codLead || !status) {
      return NextResponse.json(
        { error: 'CODLEAD e STATUS são obrigatórios' },
        { status: 400 }
      );
    }

    const idEmpresa = 1;

    // Formatar data no padrão DD/MM/YYYY
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;

    // Construir SQL dinamicamente
    let sql = `
      UPDATE AD_LEADS
      SET STATUS_LEAD = :status,
          DATA_ATUALIZACAO = TO_DATE(:dataAtualizacao, 'DD/MM/YYYY')
    `;

    const params: any = {
      status,
      dataAtualizacao: dataFormatada,
      codLead: String(codLead),
      idEmpresa
    };

    // Adicionar data de conclusão se GANHO ou PERDIDO
    if (status === 'GANHO' || status === 'PERDIDO') {
      sql += `, DATA_CONCLUSAO = TO_DATE(:dataConclusao, 'DD/MM/YYYY')`;
      params.dataConclusao = dataFormatada;
    }

    // Adicionar motivo da perda se fornecido
    if (motivoPerda && motivoPerda.trim() !== '') {
      sql += `, MOTIVO_PERDA = :motivoPerda`;
      params.motivoPerda = motivoPerda.trim();
    }

    sql += `
      WHERE CODLEAD = :codLead
        AND ID_EMPRESA = :idEmpresa
    `;

    // Validar motivo de perda para status PERDIDO
    if (status === 'PERDIDO' && (!motivoPerda || motivoPerda.trim() === '')) {
      return NextResponse.json(
        { error: 'Motivo da perda é obrigatório para marcar como perdido' },
        { status: 400 }
      );
    }

    console.log('📤 [API Status] SQL:', sql);
    console.log('📤 [API Status] Params:', params);

    await oracleService.executeQuery(sql, params);

    console.log('✅ [API Status] Status atualizado com sucesso no Oracle');

    // Verificar se foi atualizado
    const leadAtualizado = await oracleService.executeOne(
      `SELECT STATUS_LEAD, DATA_CONCLUSAO, MOTIVO_PERDA 
       FROM AD_LEADS 
       WHERE CODLEAD = :codLead AND ID_EMPRESA = :idEmpresa`,
      { codLead: String(codLead), idEmpresa }
    );

    console.log('🔍 [API Status] Lead após atualização:', leadAtualizado);

    return NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso',
      lead: leadAtualizado
    });

  } catch (error: any) {
    console.error('❌ [API Status] Erro ao atualizar status:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar status' },
      { status: 500 }
    );
  }
}
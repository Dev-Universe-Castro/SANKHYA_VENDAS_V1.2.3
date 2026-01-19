import { sankhyaDynamicAPI } from './sankhya-dynamic-api';

export interface CalculoImpostoPayload {
  notaModelo: number;
  codigoCliente: number;
  codigoEmpresa: number;
  finalidadeOperacao: number;
  codigoNatureza: number;
  despesasAcessorias?: {
    frete?: number;
    seguro?: number;
    outros?: number;
  };
  produtos: Array<{
    codigoProduto: number;
    quantidade: number;
    valorUnitario: number;
    unidade: string;
  }>;
}

export interface CalculoImpostoResposta {
  success: boolean;
  produtos?: Array<{
    codigoProduto: number;
    valorTotal: number;
    icms?: number;
    pis?: number;
    cofins?: number;
    ipi?: number;
    st?: number;
  }>;
  totais?: {
    valorProdutos: number;
    valorImpostos: number;
    valorTotal: number;
  };
  error?: string;
}

export const impostosCalculoService = {
  async calcularImpostos(
    idEmpresa: number,
    payload: CalculoImpostoPayload
  ): Promise<CalculoImpostoResposta> {
    try {
      console.log('\n📊 [IMPOSTOS] Iniciando cálculo de impostos...');
      console.log('📋 Payload:', JSON.stringify(payload, null, 2));

      const endpoint = '/v1/fiscal/impostos/calculo';

      const corpoRequisicao = {
        notaModelo: payload.notaModelo,
        codigoCliente: payload.codigoCliente,
        codigoEmpresa: payload.codigoEmpresa,
        finalidadeOperacao: payload.finalidadeOperacao,
        codigoNatureza: payload.codigoNatureza,
        despesasAcessorias: payload.despesasAcessorias || {
          frete: 0,
          seguro: 0,
          outros: 0
        },
        produtos: payload.produtos.map(p => ({
          codigoProduto: p.codigoProduto,
          quantidade: p.quantidade,
          valorUnitario: p.valorUnitario,
          unidade: p.unidade
        }))
      };

      console.log('📤 Enviando para API Sankhya:', endpoint);
      console.log('📄 Corpo:', JSON.stringify(corpoRequisicao, null, 2));

      const resposta = await sankhyaDynamicAPI.fazerRequisicao(
        idEmpresa,
        endpoint,
        'POST',
        corpoRequisicao
      );

      console.log('📥 Resposta da API:', JSON.stringify(resposta, null, 2));

      if (resposta?.statusCode && resposta.statusCode >= 400) {
        const errorMsg = resposta?.error?.message || resposta?.statusMessage || 'Erro no cálculo de impostos';
        console.error('❌ Erro no cálculo:', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      if (resposta?.error) {
        return {
          success: false,
          error: resposta.error.message || resposta.error.details || 'Erro no cálculo'
        };
      }

      console.log('✅ Cálculo de impostos concluído com sucesso!');
      
      return {
        success: true,
        produtos: resposta?.produtos || resposta?.data?.produtos || [],
        totais: resposta?.totais || resposta?.data?.totais || {
          valorProdutos: 0,
          valorImpostos: 0,
          valorTotal: 0
        }
      };

    } catch (error: any) {
      console.error('❌ Erro ao calcular impostos:', error.message);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao calcular impostos'
      };
    }
  },

  montarPayloadDeRegraImposto(
    regra: any,
    codigoCliente: number,
    produtos: Array<{ CODPROD: string; QTDNEG: number; VLRUNIT: number; CODVOL?: string }>
  ): CalculoImpostoPayload {
    return {
      notaModelo: regra.NOTA_MODELO,
      codigoCliente: codigoCliente,
      codigoEmpresa: regra.CODIGO_EMPRESA,
      finalidadeOperacao: regra.FINALIDADE_OPERACAO,
      codigoNatureza: regra.CODIGO_NATUREZA,
      despesasAcessorias: {
        frete: 0,
        seguro: 0,
        outros: 0
      },
      produtos: produtos.map(p => ({
        codigoProduto: Number(p.CODPROD),
        quantidade: p.QTDNEG,
        valorUnitario: p.VLRUNIT,
        unidade: p.CODVOL || 'UN'
      }))
    };
  }
};

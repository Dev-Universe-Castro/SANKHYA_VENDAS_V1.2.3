
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Aqui você implementaria a lógica real de análise com Gemini 2.0 Flash
    // Modelo: gemini-2.0-flash-exp
    // Por enquanto, retornando dados mock
    
    const insights = [
      {
        id: '1',
        tipo: 'oportunidade',
        titulo: 'Oportunidade Quente Detectada',
        descricao: 'Cliente ABC Ltda tem lead de R$ 50k parado há 5 dias no estágio Proposta. Produto XYZ em estoque pode facilitar fechamento.',
        valor: 'R$ 50.000',
        acao: 'Ver Lead',
        acaoUrl: '/dashboard/leads',
        prioridade: 'alta'
      },
      {
        id: '2',
        tipo: 'risco',
        titulo: 'Risco Financeiro Detectado',
        descricao: 'Cliente DEF possui 2 títulos vencidos totalizando R$ 12.5k. Recomendado verificar situação antes da próxima visita.',
        valor: 'R$ 12.500',
        acao: 'Ver Títulos',
        acaoUrl: '/dashboard/financeiro',
        prioridade: 'alta'
      },
      {
        id: '3',
        tipo: 'meta',
        titulo: 'Foco nas Propostas',
        descricao: 'Você tem 3 leads em estágio "Proposta" sem contato há mais de 48h. Priorize retorno para não perder oportunidades.',
        acao: 'Ver Leads',
        acaoUrl: '/dashboard/leads',
        prioridade: 'media'
      }
    ]

    return NextResponse.json({ insights }, { status: 200 })
  } catch (error: any) {
    console.error('Erro ao gerar insights:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar insights' },
      { status: 500 }
    )
  }
}

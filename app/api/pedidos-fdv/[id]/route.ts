
import { NextRequest, NextResponse } from 'next/server';
import { pedidosFDVService } from '@/lib/pedidos-fdv-service';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const pedido = await pedidosFDVService.buscarPorId(id);

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    return NextResponse.json(pedido);
  } catch (error: any) {
    console.error('❌ Erro ao buscar pedido FDV:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pedido', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const body = await request.json();

    await pedidosFDVService.atualizarStatus(
      id,
      body.status,
      body.nunota,
      body.erro
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar pedido FDV:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar pedido', details: error.message },
      { status: 500 }
    );
  }
}

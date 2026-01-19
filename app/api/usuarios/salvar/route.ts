import { NextResponse } from 'next/server';
import { usersService } from '@/lib/users-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📥 Recebido dados para salvar usuário:", body);

    // Extrair userData do body (pode vir aninhado ou direto)
    const userData = body.userData || body;
    const mode = body.mode || 'create';

    console.log("📝 userData extraído:", userData);
    console.log("📝 mode:", mode);

    // Obter ID_EMPRESA do usuário logado se não foi fornecido
    if (!userData.idEmpresa) {
      const cookieStore = cookies();
      const userCookie = cookieStore.get('user');

      if (userCookie?.value) {
        const usuario = JSON.parse(userCookie.value);
        userData.idEmpresa = usuario.ID_EMPRESA || usuario.id_empresa;
        console.log("✅ ID_EMPRESA obtido do cookie:", userData.idEmpresa);
      }
    }

    if (!userData.idEmpresa) {
      return NextResponse.json(
        { error: "ID_EMPRESA não foi fornecido e não foi possível obter do usuário logado" },
        { status: 400 }
      );
    }

    let result;
    if (mode === 'edit' && userData.id) {
      result = await usersService.update(userData.id, userData);
    } else {
      result = await usersService.create(userData);
    }

    console.log("✅ Usuário salvo com sucesso:", result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erro ao salvar usuário:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao salvar usuário" },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
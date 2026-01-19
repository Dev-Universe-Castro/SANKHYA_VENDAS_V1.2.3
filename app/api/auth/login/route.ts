import { NextResponse } from 'next/server';
import { oracleAuthService } from '@/lib/oracle-auth-service';
import { contratosService } from '@/lib/contratos-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔐 Tentando login via Oracle Database...');
    const user = await oracleAuthService.login(email, password);

    if (!user) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    // Buscar contrato da empresa do usuário
    console.log(`📋 Buscando contrato para empresa ${user.ID_EMPRESA}...`);
    const contrato = await contratosService.getContratoByEmpresa(user.ID_EMPRESA);

    if (!contrato) {
      return NextResponse.json(
        { error: 'Empresa não possui contrato ativo' },
        { status: 403 }
      );
    }

    // Preparar dados do usuário com informações da empresa
    const userWithCompanyData = {
      ...user,
      contratoAtivo: true,
      isSandbox: contrato.IS_SANDBOX === 'S',
      licencas: contrato.LICENCAS,
      syncAtivo: contrato.SYNC_ATIVO === 'S',
      authType: contrato.AUTH_TYPE || 'LEGACY'
    };

    // Sanitizar dados para evitar problemas de JSON
      const sanitizeString = (str: string | null | undefined): string => {
        if (!str) return '';
        // Remover caracteres de controle e garantir que aspas sejam escapadas
        return str.replace(/[\x00-\x1F\x7F]/g, '').trim();
      };

      const userData = {
        id: user.CODUSUARIO,
        name: sanitizeString(user.NOME) || user.EMAIL.split('@')[0],
        email: sanitizeString(user.EMAIL),
        role: user.FUNCAO as any,
        avatar: sanitizeString(user.AVATAR) || '',
        codVendedor: user.CODVEND || null,
        ID_EMPRESA: user.ID_EMPRESA
      };

      console.log('🍪 Salvando dados do usuário no cookie:', {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role
      });

      // Cookie acessível pelo cliente para getCurrentUser()
      // Usar encodeURIComponent duas vezes para garantir encoding correto
      const userDataJson = JSON.stringify(userData);
      const encodedUserData = encodeURIComponent(userDataJson);
      
      cookies().set('user', encodedUserData, {
        httpOnly: false, // Permitir acesso pelo cliente
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 dias
      })

      return NextResponse.json({ 
        user: userWithCompanyData,
        message: 'Login realizado com sucesso'
      });

  } catch (error: any) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login. Tente novamente.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
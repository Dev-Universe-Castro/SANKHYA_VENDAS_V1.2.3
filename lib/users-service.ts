import { oracleService } from './oracle-db';
import { cryptoService } from './crypto-service';
import type { User } from './types';

export type { User };

export const usersService = {
  async getAll(): Promise<User[]> {
    try {
      const sql = `
        SELECT 
          CODUSUARIO, 
          NOME, 
          EMAIL, 
          FUNCAO, 
          STATUS, 
          AVATAR, 
          CODVEND, 
          SENHA
        FROM AD_USUARIOSVENDAS
        ORDER BY CODUSUARIO
      `;

      const usuarios = await oracleService.executeQuery(sql, {});

      return usuarios.map((u: any) => ({
        id: parseInt(u.CODUSUARIO) || 0,
        name: u.NOME || '',
        email: u.EMAIL || '',
        role: u.FUNCAO || 'Vendedor',
        status: u.STATUS || 'pendente',
        password: u.SENHA || '',
        avatar: u.AVATAR || '',
        codVendedor: u.CODVEND !== null && u.CODVEND !== undefined ? parseInt(u.CODVEND) : undefined
      }));
    } catch (erro: any) {
      console.error("❌ Erro ao buscar usuários:", erro);
      return [];
    }
  },

  async getPending(): Promise<User[]> {
    try {
      const sql = `
        SELECT 
          CODUSUARIO, 
          NOME, 
          EMAIL, 
          FUNCAO, 
          STATUS, 
          AVATAR, 
          CODVEND, 
          SENHA
        FROM AD_USUARIOSVENDAS
        WHERE STATUS = 'pendente'
        ORDER BY CODUSUARIO
      `;

      const usuarios = await oracleService.executeQuery(sql, {});

      return usuarios.map((u: any) => ({
        id: parseInt(u.CODUSUARIO) || 0,
        name: u.NOME || '',
        email: u.EMAIL || '',
        role: u.FUNCAO || 'Vendedor',
        status: u.STATUS || 'pendente',
        password: u.SENHA || '',
        avatar: u.AVATAR || '',
        codVendedor: u.CODVEND !== null && u.CODVEND !== undefined ? parseInt(u.CODVEND) : undefined
      }));
    } catch (erro) {
      console.error("Erro ao buscar usuários pendentes:", erro);
      return [];
    }
  },

  async getById(id: number): Promise<User | undefined> {
    try {
      const sql = `
        SELECT 
          CODUSUARIO, 
          NOME, 
          EMAIL, 
          FUNCAO, 
          STATUS, 
          AVATAR, 
          CODVEND, 
          SENHA
        FROM AD_USUARIOSVENDAS
        WHERE CODUSUARIO = :id
      `;

      const usuarios = await oracleService.executeQuery(sql, { id });

      if (!usuarios || usuarios.length === 0) {
        return undefined;
      }

      const u = usuarios[0];
      return {
        id: parseInt(u.CODUSUARIO) || 0,
        name: u.NOME || '',
        email: u.EMAIL || '',
        role: u.FUNCAO || 'Vendedor',
        status: u.STATUS || 'pendente',
        password: u.SENHA || '',
        avatar: u.AVATAR || '',
        codVendedor: u.CODVEND !== null && u.CODVEND !== undefined ? parseInt(u.CODVEND) : undefined
      };
    } catch (erro) {
      console.error("Erro ao buscar usuário por ID:", erro);
      return undefined;
    }
  },

  async register(userData: { name: string; email: string; password: string }): Promise<User> {
    const existingUsers = await this.search(userData.email);
    if (existingUsers.length > 0) {
      throw new Error("Email já cadastrado");
    }

    const hashedPassword = await cryptoService.hashPassword(userData.password);

    try {
      const sql = `
        INSERT INTO AD_USUARIOSVENDAS (NOME, EMAIL, SENHA, FUNCAO, STATUS)
        VALUES (:nome, :email, :senha, 'Usuário', 'pendente')
      `;

      await oracleService.executeQuery(sql, {
        nome: userData.name,
        email: userData.email,
        senha: hashedPassword
      });

      console.log('✅ Usuário criado com sucesso');

      // Buscar o usuário criado
      const newUsers = await this.search(userData.email);
      if (newUsers.length > 0) {
        return newUsers[0];
      }

      // Retornar dados básicos se não encontrar
      return {
        id: 0,
        name: userData.name,
        email: userData.email,
        role: 'Usuário',
        status: 'pendente',
        avatar: '',
        password: hashedPassword,
        codVendedor: undefined
      };
    } catch (erro: any) {
      throw new Error(`Erro ao registrar usuário: ${erro.message}`);
    }
  },

  async create(userData: Omit<User, "id">): Promise<User> {
    console.log("🔍 Validando dados para criar usuário:", {
      hasPassword: !!userData.password,
      passwordLength: userData.password?.length,
      codVendedor: userData.codVendedor,
      role: userData.role
    });

    if (!userData.password || userData.password.trim() === '') {
      console.error("❌ Senha inválida:", {
        password: userData.password,
        isEmpty: !userData.password,
        isTrimEmpty: userData.password?.trim() === ''
      });
      throw new Error("Senha é obrigatória para criar um novo usuário");
    }

    const hashedPassword = userData.password.startsWith('$2')
      ? userData.password
      : await cryptoService.hashPassword(userData.password);

    const avatarUrl = userData.avatar && userData.avatar.trim() !== '' ? userData.avatar : '';
    
    // Garantir que codVendedor seja NUMBER ou NULL
    const codVendedorFinal = userData.codVendedor ? Number(userData.codVendedor) : null;

    console.log("📝 Dados preparados para inserção:", {
      nome: userData.name,
      email: userData.email,
      funcao: userData.role,
      status: userData.status,
      avatar: avatarUrl ? 'SIM' : 'NÃO',
      codvend: codVendedorFinal
    });

    try {
      const sql = `
        INSERT INTO AD_USUARIOSVENDAS (NOME, EMAIL, SENHA, FUNCAO, STATUS, AVATAR, CODVEND)
        VALUES (:nome, :email, :senha, :funcao, :status, :avatar, :codvend)
      `;

      await oracleService.executeQuery(sql, {
        nome: userData.name,
        email: userData.email,
        senha: hashedPassword,
        funcao: userData.role,
        status: userData.status,
        avatar: avatarUrl,
        codvend: codVendedorFinal
      });

      console.log("✅ Usuário criado no Oracle com CODVEND:", codVendedorFinal);

      // Aguardar um momento para o banco indexar
      await new Promise(resolve => setTimeout(resolve, 500));

      // Buscar o usuário criado
      const newUsers = await this.search(userData.email);
      if (newUsers.length > 0) {
        console.log("✅ Usuário encontrado após criação:", newUsers[0]);
        return newUsers[0];
      }

      // Se não encontrou, retornar dados mockados com ID temporário
      console.log("⚠️ Usuário criado mas não encontrado na busca, retornando dados básicos");
      return {
        id: Date.now(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        avatar: avatarUrl,
        password: hashedPassword,
        codVendedor: codVendedorFinal
      };
    } catch (erro: any) {
      console.error("❌ Erro detalhado ao criar usuário:", erro);
      throw new Error(`Erro ao criar usuário: ${erro.message}`);
    }
  },

  async update(id: number, userData: Partial<User>): Promise<User | null> {
    const currentUser = await this.getById(id);
    if (!currentUser) {
      throw new Error("Usuário não encontrado");
    }

    console.log("🔄 Atualizando usuário:", { id, userData, currentUser });

    const mergedData = {
      name: userData.name !== undefined ? userData.name : currentUser.name,
      email: userData.email !== undefined ? userData.email : currentUser.email,
      role: userData.role !== undefined ? userData.role : currentUser.role,
      status: userData.status !== undefined ? userData.status : currentUser.status,
      avatar: userData.avatar !== undefined ? userData.avatar : currentUser.avatar,
      codVendedor: userData.codVendedor !== undefined ? userData.codVendedor : currentUser.codVendedor
    };

    const avatarUrl = (mergedData.avatar && mergedData.avatar.trim() !== '') ? mergedData.avatar : '';
    
    // Garantir que codVendedor seja NUMBER ou NULL
    const codVendedorFinal = mergedData.codVendedor ? Number(mergedData.codVendedor) : null;

    console.log("📝 Dados mesclados para atualização:", { 
      mergedData, 
      avatarUrl,
      codVendedorFinal 
    });

    try {
      let sql = `
        UPDATE AD_USUARIOSVENDAS
        SET NOME = :nome,
            EMAIL = :email,
            FUNCAO = :funcao,
            STATUS = :status,
            AVATAR = :avatar,
            CODVEND = :codvend
      `;

      const binds: any = {
        nome: mergedData.name,
        email: mergedData.email,
        funcao: mergedData.role,
        status: mergedData.status,
        avatar: avatarUrl,
        codvend: codVendedorFinal,
        id: id
      };

      // Se há nova senha, incluir na atualização
      if (userData.password && userData.password.trim() !== '') {
        const hashedPassword = userData.password.startsWith('$2')
          ? userData.password
          : await cryptoService.hashPassword(userData.password);

        sql += `, SENHA = :senha`;
        binds.senha = hashedPassword;
      }

      sql += ` WHERE CODUSUARIO = :id`;

      console.log("📤 Executando atualização SQL com CODVEND:", codVendedorFinal);
      await oracleService.executeQuery(sql, binds);

      // Aguardar um momento para o banco atualizar
      await new Promise(resolve => setTimeout(resolve, 300));

      const updatedUser = await this.getById(id);
      console.log("✅ Usuário atualizado:", updatedUser);
      return updatedUser || null;
    } catch (erro: any) {
      console.error("❌ Erro ao atualizar usuário:", erro);
      throw new Error(`Erro ao atualizar usuário: ${erro.message}`);
    }
  },

  async approve(id: number): Promise<User | null> {
    return await this.update(id, { status: 'ativo' });
  },

  async block(id: number): Promise<User | null> {
    return await this.update(id, { status: 'bloqueado' });
  },

  async delete(id: number): Promise<boolean> {
    try {
      const sql = `
        UPDATE AD_USUARIOSVENDAS
        SET STATUS = 'bloqueado'
        WHERE CODUSUARIO = :id
      `;

      await oracleService.executeQuery(sql, { id });
      return true;
    } catch (erro) {
      return false;
    }
  },

  async search(term: string): Promise<User[]> {
    try {
      const sql = `
        SELECT 
          CODUSUARIO, 
          NOME, 
          EMAIL, 
          FUNCAO, 
          STATUS, 
          AVATAR, 
          CODVEND, 
          SENHA
        FROM AD_USUARIOSVENDAS
        WHERE UPPER(NOME) LIKE :termo
           OR UPPER(EMAIL) LIKE :termo
           OR UPPER(FUNCAO) LIKE :termo
        ORDER BY CODUSUARIO
      `;

      const usuarios = await oracleService.executeQuery(sql, { 
        termo: `%${term.toUpperCase()}%` 
      });

      return usuarios.map((u: any) => ({
        id: parseInt(u.CODUSUARIO) || 0,
        name: u.NOME || '',
        email: u.EMAIL || '',
        role: u.FUNCAO || 'Vendedor',
        status: u.STATUS || 'pendente',
        password: u.SENHA || '',
        avatar: u.AVATAR || '',
        codVendedor: u.CODVEND !== null && u.CODVEND !== undefined ? parseInt(u.CODVEND) : undefined
      }));
    } catch (erro) {
      console.error("Erro ao buscar usuários:", erro);
      return [];
    }
  },

  async getByEmail(email: string): Promise<User[]> {
    try {
      console.log("🔍 Buscando usuário por email:", email);

      const sql = `
        SELECT 
          CODUSUARIO, 
          NOME, 
          EMAIL, 
          FUNCAO, 
          STATUS, 
          AVATAR, 
          CODVEND, 
          SENHA
        FROM AD_USUARIOSVENDAS
        WHERE UPPER(EMAIL) = :email
      `;

      const usuarios = await oracleService.executeQuery(sql, { 
        email: email.toUpperCase() 
      });

      if (!usuarios || usuarios.length === 0) {
        console.log("⚠️ Nenhum usuário encontrado com o email:", email);
        return [];
      }

      const result = usuarios.map((u: any) => ({
        id: parseInt(u.CODUSUARIO) || 0,
        name: u.NOME || '',
        email: u.EMAIL || '',
        role: u.FUNCAO || 'Vendedor',
        status: u.STATUS || 'pendente',
        password: u.SENHA || '',
        avatar: u.AVATAR || '',
        codVendedor: u.CODVEND !== null && u.CODVEND !== undefined ? parseInt(u.CODVEND) : undefined
      }));

      console.log("✅ Usuário encontrado:", result.length > 0 ? { id: result[0].id, name: result[0].name, email: result[0].email } : 'nenhum');
      return result;
    } catch (erro: any) {
      console.error("❌ Erro ao buscar usuário por email:", erro);
      return [];
    }
  },

  async ensureSuperAdmin(): Promise<void> {
    try {
      const email = 'admin@sankhya.com.br';
      const existing = await this.getByEmail(email);
      
      if (existing.length === 0) {
        console.log("👤 [ENSURE-ADMIN] Criando super admin padrão...");
        await this.create({
          name: 'Super Admin',
          email: email,
          password: 'admin',
          role: 'Administrador',
          status: 'ativo',
          avatar: '',
          codVendedor: undefined
        });
        console.log("✅ [ENSURE-ADMIN] Super admin criado com sucesso.");
      }
    } catch (error) {
      console.error("❌ [ENSURE-ADMIN] Erro ao garantir super admin:", error);
    }
  }
};
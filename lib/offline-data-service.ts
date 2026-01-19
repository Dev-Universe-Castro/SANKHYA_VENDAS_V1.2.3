import { db } from './client-db';

export class OfflineDataService {

  // ==================== SINCRONIZAÇÃO ====================

  static async sincronizarTudo(prefetchData: any) {
    try {
      console.log('🔄 Iniciando sincronização completa do IndexedDB...');

      const promises = [];

      // Produtos
      if (prefetchData.produtos?.data) {
        promises.push(
          db.produtos.clear().then(() => 
            db.produtos.bulkAdd(prefetchData.produtos.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.produtos.count} produtos sincronizados`)
          )
        );
      }

      // Parceiros
      if (prefetchData.parceiros?.data) {
        promises.push(
          db.parceiros.clear().then(() => 
            db.parceiros.bulkAdd(prefetchData.parceiros.data.map((p: any) => ({
              ...p,
              CODTAB: Number(p.CODTAB) || 0
            })))
          ).then(() => 
            console.log(`✅ ${prefetchData.parceiros.count} parceiros sincronizados`)
          )
        );
      }

      // Financeiro
      if (prefetchData.financeiro?.data) {
        promises.push(
          db.financeiro.clear().then(() => 
            db.financeiro.bulkAdd(prefetchData.financeiro.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.financeiro.count} títulos financeiros sincronizados`)
          )
        );
      }

      // Tipos de Negociação
      if (prefetchData.tiposNegociacao?.data) {
        promises.push(
          db.tiposNegociacao.clear().then(() => 
            db.tiposNegociacao.bulkAdd(prefetchData.tiposNegociacao.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.tiposNegociacao.count} tipos de negociação sincronizados`)
          )
        );
      }

      // Tipos de Operação
      if (prefetchData.tiposOperacao?.data) {
        promises.push(
          db.tiposOperacao.clear().then(() => 
            db.tiposOperacao.bulkAdd(prefetchData.tiposOperacao.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.tiposOperacao.count} tipos de operação sincronizados`)
          )
        );
      }

      // Tipos de Pedido
      if (prefetchData.tiposPedido?.data) {
        promises.push(
          db.tiposPedido.clear().then(() => 
            db.tiposPedido.bulkAdd(prefetchData.tiposPedido.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.tiposPedido.count} tipos de pedido sincronizados`)
          )
        );
      }

      // Estoques
      if (prefetchData.estoques?.data) {
        promises.push(
          db.estoque.clear().then(() => 
            db.estoque.bulkAdd(prefetchData.estoques.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.estoques.count} estoques sincronizados`)
          )
        );
      }

      // Preços (exceções)
      if (prefetchData.excecoesPrecos?.data) {
        promises.push(
          db.precos.clear().then(() => 
            db.precos.bulkAdd(prefetchData.excecoesPrecos.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.excecoesPrecos.count} preços sincronizados`)
          )
        );
      }

      // Tabelas de Preços
      if (prefetchData.tabelasPrecos?.data) {
        promises.push(
          db.tabelasPrecos.clear().then(() => 
            db.tabelasPrecos.bulkAdd(prefetchData.tabelasPrecos.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.tabelasPrecos.count} tabelas de preços sincronizadas`)
          )
        );
      }

      // Tabelas de Preços Config
      if (prefetchData.tabelasPrecosConfig?.data) {
        promises.push(
          db.tabelasPrecosConfig.clear().then(() => 
            db.tabelasPrecosConfig.bulkAdd(prefetchData.tabelasPrecosConfig.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.tabelasPrecosConfig.count} tabelas de preços config sincronizadas`)
          )
        );
      }

      // Pedidos
      if (prefetchData.pedidos?.data) {
        promises.push(
          db.pedidos.clear().then(() => 
            db.pedidos.bulkAdd(prefetchData.pedidos.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.pedidos.count} pedidos sincronizados`)
          )
        );
      }

      // Usuários
      if (prefetchData.usuarios?.data) {
        promises.push(
          db.usuarios.clear().then(() => 
            db.usuarios.bulkAdd(prefetchData.usuarios.data.map((u: any) => ({
              ...u,
              username: u.email || u.EMAIL
            })))
          ).then(() => 
            console.log(`✅ ${prefetchData.usuarios.count} usuários sincronizados`)
          )
        );
      }

      // Vendedores
      if (prefetchData.vendedores?.data) {
        promises.push(
          db.vendedores.clear().then(() => 
            db.vendedores.bulkAdd(prefetchData.vendedores.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.vendedores.count} vendedores sincronizados`)
          )
        );
      }

      // Volumes Alternativos
      if (prefetchData.volumes?.data) {
        promises.push(
          db.volumes.clear().then(() => 
            db.volumes.bulkAdd(prefetchData.volumes.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.volumes.count} volumes alternativos sincronizados`)
          )
        );
      }

      // Regras de Impostos
      if (prefetchData.regrasImpostos?.data) {
        promises.push(
          db.regrasImpostos.clear().then(() => 
            db.regrasImpostos.bulkAdd(prefetchData.regrasImpostos.data)
          ).then(() => 
            console.log(`✅ ${prefetchData.regrasImpostos.count} regras de impostos sincronizadas`)
          )
        );
      }

      await Promise.all(promises);

      // Salvar metadados da sincronização
      await db.metadados.put({
        chave: 'lastSync',
        valor: new Date().toISOString(),
        timestamp: Date.now()
      });

      console.log('✅ Sincronização completa do IndexedDB finalizada!');
      return true;

    } catch (error) {
      console.error('❌ Erro na sincronização do IndexedDB:', error);
      throw error;
    }
  }

  // ==================== LEITURA DE DADOS ====================

  static async getProdutos(filtros?: { ativo?: string, search?: string }) {
    try {
      let query = db.produtos.toCollection();

      if (filtros?.ativo === 'S') {
        query = db.produtos.where('ATIVO').equals('S');
      }

      let produtos = await query.toArray();

      if (filtros?.search) {
        const normalizarTexto = (texto: string) => {
          return texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        }

        const searchNormalizado = normalizarTexto(filtros.search)
        
        produtos = produtos.filter((p: any) => {
          const descricaoNormalizada = normalizarTexto(p.DESCRPROD || '')
          const matchDescr = descricaoNormalizada.includes(searchNormalizado)
          const matchCod = p.CODPROD?.toString().includes(filtros.search!)
          return matchDescr || matchCod
        });
      }

      return produtos;
    } catch (error) {
      console.error('[OFFLINE] Erro ao buscar produtos:', error);
      return [];
    }
  }

  static async getVolumes(codProd?: string) {
    try {
      if (codProd) {
        return await db.volumes.where('CODPROD').equals(codProd).toArray();
      }
      return await db.volumes.toArray();
    } catch (error) {
      console.error('[OFFLINE] Erro ao buscar volumes:', error);
      return [];
    }
  }

  static async getParceiros(filtros?: { codVend?: number, search?: string }) {
    try {
      let query = db.parceiros.toCollection();

      if (filtros?.codVend) {
        query = db.parceiros.where('CODVEND').equals(filtros.codVend);
      }

      let parceiros = await query.toArray();

      if (filtros?.search) {
        const searchLower = filtros.search.toLowerCase();
        parceiros = parceiros.filter(p => 
          p.NOMEPARC?.toLowerCase().includes(searchLower) ||
          p.RAZAOSOCIAL?.toLowerCase().includes(searchLower) ||
          p.CGC_CPF?.includes(filtros.search!)
        );
      }

      return parceiros;
    } catch (error) {
      console.error('❌ Erro ao buscar parceiros:', error);
      return [];
    }
  }

  static async saveParceiros(parceiros: any[]) {
    try {
      await db.parceiros.clear();
      await db.parceiros.bulkAdd(parceiros);
      console.log(`✅ ${parceiros.length} parceiros salvos no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar parceiros no IndexedDB:', error);
      throw error;
    }
  }

  static async getFinanceiro(codParc?: number) {
    try {
      if (codParc) {
        return await db.financeiro.where('CODPARC').equals(codParc).toArray();
      }
      return await db.financeiro.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar financeiro:', error);
      return [];
    }
  }

  static async getTitulos(filtros?: { searchTerm?: string, searchNroTitulo?: string }) {
    try {
      let titulos = await db.financeiro.toArray();

      // Aplicar filtros
      if (filtros?.searchNroTitulo) {
        titulos = titulos.filter(t => 
          t.NUFIN?.toString().includes(filtros.searchNroTitulo!)
        );
      }

      if (filtros?.searchTerm) {
        const searchLower = filtros.searchTerm.toLowerCase();
        titulos = titulos.filter(t => 
          t.CODPARC?.toString().includes(filtros.searchTerm!) ||
          t.NOMEPARC?.toLowerCase().includes(searchLower)
        );
      }

      // Mapear para o formato esperado
      return titulos.map((t: any) => {
        const estaBaixado = t.DHBAIXA || (t.VLRBAIXA && parseFloat(t.VLRBAIXA) > 0);
        const valorTitulo = estaBaixado
          ? parseFloat(t.VLRBAIXA || 0)
          : parseFloat(t.VLRDESDOB || 0);

        return {
          nroTitulo: t.NUFIN?.toString() || '',
          parceiro: t.NOMEPARC || `Parceiro ${t.CODPARC}`,
          valor: valorTitulo,
          dataVencimento: t.DTVENC ? new Date(t.DTVENC).toISOString().split('T')[0] : '',
          dataNegociacao: t.DTNEG ? new Date(t.DTNEG).toISOString().split('T')[0] : '',
          tipo: t.PROVISAO === 'S' ? 'Provisão' : 'Real',
          status: estaBaixado ? 'Baixado' : 'Aberto',
          numeroParcela: 1,
          CODPARC: t.CODPARC,
          NOMEPARC: t.NOMEPARC,
          DTVENC: t.DTVENC
        };
      });
    } catch (error) {
      console.error('❌ Erro ao buscar títulos:', error);
      return [];
    }
  }

  static async getPedidos(filtros?: { codVend?: number }) {
    try {
      if (filtros?.codVend) {
        return await db.pedidos.where('CODVEND').equals(filtros.codVend).toArray();
      }
      return await db.pedidos.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar pedidos:', error);
      return [];
    }
  }

  static async savePedidos(pedidos: any[]) {
    try {
      await db.pedidos.clear();
      await db.pedidos.bulkAdd(pedidos);
      console.log(`✅ ${pedidos.length} pedidos salvos no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar pedidos no IndexedDB:', error);
      throw error;
    }
  }

  static async getTiposNegociacao() {
    try {
      return await db.tiposNegociacao.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar tipos negociação:', error);
      return [];
    }
  }

  static async getTiposOperacao() {
    try {
      return await db.tiposOperacao.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar tipos operação:', error);
      return [];
    }
  }

  static async getTiposPedido() {
    try {
      return await db.tiposPedido.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar tipos pedido:', error);
      return [];
    }
  }

  static async getRegrasImpostos() {
    try {
      return await db.regrasImpostos.where('ATIVO').equals('S').toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar regras de impostos:', error);
      return [];
    }
  }

  static async getEstoque(codProd?: number) {
    try {
      if (codProd) {
        return await db.estoque.where('CODPROD').equals(codProd).toArray();
      }
      return await db.estoque.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar estoque:', error);
      return [];
    }
  }

  static async getEstoques() {
    try {
      return await db.estoque.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar estoques:', error);
      return [];
    }
  }

  static async saveVolumes(volumes: any[]) {
    try {
      await db.volumes.clear();
      await db.volumes.bulkAdd(volumes);
      console.log(`✅ ${volumes.length} volumes alternativos salvos no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar volumes no IndexedDB:', error);
      throw error;
    }
  }

  static async getPrecos(codProd: number, nutab?: number) {
    try {
      const totalPrecos = await db.precos.count();
      if (totalPrecos === 0) return [];

      // Buscar por CODPROD (sempre numérico)
      const todosPrecoProduto = await db.precos.where('CODPROD').equals(Number(codProd)).toArray();
      
      console.log(`[OFFLINE] Buscando preço para CODPROD: ${codProd}, NUTAB: ${nutab}. Encontrados para o produto:`, todosPrecoProduto.length);

      if (nutab !== undefined && nutab !== null) {
        const nutabBusca = Number(nutab);
        const precos = todosPrecoProduto.filter(p => {
          const pNutab = p.NUTAB !== undefined ? p.NUTAB : p.nutab;
          return pNutab !== undefined && pNutab !== null && Number(pNutab) === nutabBusca;
        });
        
        console.log(`[OFFLINE] Preços após filtrar por NUTAB ${nutabBusca}:`, precos.length);
        return precos;
      }

      return todosPrecoProduto;
    } catch (error) {
      console.error('❌ Erro ao buscar preços:', error);
      return [];
    }
  }

  static async getExcecoesPrecos() {
    try {
      return await db.precos.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar exceções de preços:', error);
      return [];
    }
  }

  static async saveExcecoesPrecos(excecoes: any[]) {
    try {
      await db.precos.clear();
      await db.precos.bulkAdd(excecoes);
      console.log(`✅ ${excecoes.length} exceções de preços salvas no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar exceções de preços no IndexedDB:', error);
      throw error;
    }
  }

  static async saveTabelasPrecos(tabelas: any[]) {
    try {
      await db.tabelasPrecos.clear();
      await db.tabelasPrecos.bulkAdd(tabelas);
      console.log(`✅ ${tabelas.length} tabelas de preços salvas no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar tabelas de preços no IndexedDB:', error);
      throw error;
    }
  }

  static async saveTabelasPrecosConfig(configs: any[]) {
    try {
      await db.tabelasPrecosConfig.clear();
      await db.tabelasPrecosConfig.bulkAdd(configs);
      console.log(`✅ ${configs.length} configurações de tabelas de preços salvas no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar configurações de tabelas de preços no IndexedDB:', error);
      throw error;
    }
  }

  static async getTabelasPrecos() {
    try {
      return await db.tabelasPrecos.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar tabelas de preços:', error);
      return [];
    }
  }

  static async getTabelasPrecosConfig() {
    try {
      return await db.tabelasPrecosConfig.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar tabelas de preços config:', error);
      return [];
    }
  }

  static async getUsuarios(filtros?: { search?: string, status?: string }) {
    try {
      let query = db.usuarios.toCollection();

      let usuarios = await query.toArray();

      // Aplicar filtros
      if (filtros?.status) {
        usuarios = usuarios.filter(u => u.STATUS === filtros.status);
      }

      if (filtros?.search) {
        const searchLower = filtros.search.toLowerCase();
        usuarios = usuarios.filter(u => 
          u.NOME?.toLowerCase().includes(searchLower) ||
          u.EMAIL?.toLowerCase().includes(searchLower) ||
          u.FUNCAO?.toLowerCase().includes(searchLower)
        );
      }

      return usuarios;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      return [];
    }
  }

  static async setUsuarios(usuarios: any[]) {
    try {
      await db.usuarios.clear();
      await db.usuarios.bulkAdd(usuarios.map(u => ({
        ...u,
        username: u.email || u.EMAIL,
        CODUSUARIO: u.CODUSUARIO || u.id,
        NOME: u.NOME || u.name,
        EMAIL: u.EMAIL || u.email,
        FUNCAO: u.FUNCAO || u.role,
        STATUS: u.STATUS || u.status,
        AVATAR: u.AVATAR || u.avatar,
        CODVEND: u.CODVEND || u.codVendedor
      })));
      console.log(`✅ ${usuarios.length} usuários salvos no IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao salvar usuários no IndexedDB:', error);
      throw error;
    }
  }

  static async addUsuario(usuario: any) {
    try {
      await db.usuarios.add({
        ...usuario,
        username: usuario.email || usuario.EMAIL,
        CODUSUARIO: usuario.CODUSUARIO || usuario.id,
        NOME: usuario.NOME || usuario.name,
        EMAIL: usuario.EMAIL || usuario.email,
        FUNCAO: usuario.FUNCAO || usuario.role,
        STATUS: usuario.STATUS || usuario.status,
        AVATAR: usuario.AVATAR || usuario.avatar,
        CODVEND: usuario.CODVEND || usuario.codVendedor
      });
      console.log('✅ Usuário adicionado ao IndexedDB');
    } catch (error) {
      console.error('❌ Erro ao adicionar usuário:', error);
      throw error;
    }
  }

  static async updateUsuario(usuario: any) {
    try {
      const codusuario = usuario.CODUSUARIO || usuario.id;
      await db.usuarios.update(codusuario, {
        ...usuario,
        username: usuario.email || usuario.EMAIL,
        CODUSUARIO: codusuario,
        NOME: usuario.NOME || usuario.name,
        EMAIL: usuario.EMAIL || usuario.email,
        FUNCAO: usuario.FUNCAO || usuario.role,
        STATUS: usuario.STATUS || usuario.status,
        AVATAR: usuario.AVATAR || usuario.avatar,
        CODVEND: usuario.CODVEND || usuario.codVendedor
      });
      console.log('✅ Usuário atualizado no IndexedDB');
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  static async updateUsuarioStatus(id: number, status: string) {
    try {
      await db.usuarios.update(id, { STATUS: status });
      console.log(`✅ Status do usuário ${id} atualizado para ${status}`);
    } catch (error) {
      console.error('❌ Erro ao atualizar status do usuário:', error);
      throw error;
    }
  }

  static async deleteUsuario(id: number) {
    try {
      await db.usuarios.delete(id);
      console.log(`✅ Usuário ${id} removido do IndexedDB`);
    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      throw error;
    }
  }

  static async getVendedores() {
    try {
      return await db.vendedores.toArray();
    } catch (error) {
      console.error('❌ Erro ao buscar vendedores:', error);
      return [];
    }
  }

  static async getLastSync() {
    try {
      const meta = await db.metadados.get('lastSync');
      return meta?.valor || null;
    } catch (error) {
      console.error('❌ Erro ao buscar última sincronização:', error);
      return null;
    }
  }

  static async isDataAvailable() {
    try {
      const [produtos, parceiros] = await Promise.all([
        db.produtos.limit(1).toArray(),
        db.parceiros.limit(1).toArray()
      ]);

      return produtos.length > 0 && parceiros.length > 0;
    } catch (error) {
      return false;
    }
  }
}
// ─────────────────────────────────────────────────────────────
//  api.js  –  Serviço global de integração com o backend
//  Base URL: produção (Heroku) ou local via VITE_API_URL
// ─────────────────────────────────────────────────────────────

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://saas-hotel-istoepousada-dc98593a88fc.herokuapp.com';

  // const BASE_URL =
  // import.meta.env.VITE_API_URL ||
  // 'http://localhost:8080';

// ── Chaves do localStorage ────────────────────────────────────
const TOKEN_KEY   = 'hotel_token';
const USER_KEY    = 'hotel_user';

// ─────────────────────────────────────────────────────────────
//  TOKEN HELPERS
// ─────────────────────────────────────────────────────────────
export const tokenStorage = {
  get:    ()        => localStorage.getItem(TOKEN_KEY),
  set:    (token)   => localStorage.setItem(TOKEN_KEY, token),
  remove: ()        => localStorage.removeItem(TOKEN_KEY),
};

export const userStorage = {
  get:    ()       => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  set:    (user)   => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  remove: ()       => localStorage.removeItem(USER_KEY),
};

// ─────────────────────────────────────────────────────────────
//  PERMISSÕES HELPERS
//  O backend retorna cargo.telas[] com permissoes[] por tela.
// ─────────────────────────────────────────────────────────────

/**
 * Retorna true se o usuário tem a tela informada ou é ADMIN.
 * @param {object} user   – objeto salvo no localStorage
 * @param {string} tela   – ex: 'FINANCEIRO', 'PERNOITES', etc.
 */
export function hasScreen(user, tela) {
  if (!user?.cargo?.telas) return false;
  return user.cargo.telas.some(
    (t) => t.nome === 'ADMIN' || t.nome === tela,
  );
}

/**
 * Retorna true se o usuário tem a permissão informada dentro da tela.
 * ADMIN tem acesso a tudo.
 * @param {object} user
 * @param {string} tela       – ex: 'FINANCEIRO'
 * @param {string} permissao  – ex: 'EDITAR', 'NOVO LANCAMENTO'
 */
export function hasPermission(user, tela, permissao) {
  if (!user?.cargo?.telas) return false;
  const isAdmin = user.cargo.telas.some((t) => t.nome === 'ADMIN');
  if (isAdmin) return true;

  const telaObj = user.cargo.telas.find((t) => t.nome === tela);
  if (!telaObj) return false;

  return telaObj.permissoes.some(
    (p) => p.permissao === permissao || p.permissao === 'ACESSO TOTAL',
  );
}

/**
 * Mapeia nome de tela do backend → id de rota do frontend.
 */
const TELA_TO_ROUTE = {
  DASHBOARD:    'dashboard',
  PERNOITES:    'stays',
  APARTAMENTOS: 'rooms',
  DAY_USE:      'dayuse',
  RESERVAS:     'bookings',
  FINANCEIRO:   'financial',
  ITENS:        'inventory',
  CADASTRO:     'registers',
  PRECOS:       'pricing',
  FUNCIONARIOS: 'users',
  ADMIN:        null, // admin desbloqueia tudo
};

/**
 * Retorna a lista de route IDs que o usuário pode acessar.
 */
export function getAllowedRoutes(user) {
  if (!user?.cargo?.telas) return [];
  const isAdmin = user.cargo.telas.some((t) => t.nome === 'ADMIN');
  if (isAdmin) return Object.values(TELA_TO_ROUTE).filter(Boolean).concat(['permissions']);

  return user.cargo.telas
    .map((t) => TELA_TO_ROUTE[t.nome])
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
//  HTTP CLIENT BASE
// ─────────────────────────────────────────────────────────────

/**
 * Wrapper central para fetch.
 * - Injeta Bearer token automaticamente quando disponível.
 * - Lança ApiError com { status, message, data } em caso de erro HTTP.
 */
async function request(path, { method = 'GET', body, headers = {}, params, formData } = {}) {
  const token = tokenStorage.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)),
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    // FormData: browser define Content-Type com boundary automaticamente
    headers: formData ? headers : { 'Content-Type': 'application/json', ...headers },
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  // sem conteúdo (ex: 204 No Content)
  if (res.status === 204) return null;

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    // Token inválido ou expirado → limpa sessão e dispara evento de logout
    if (res.status === 401) {
      tokenStorage.remove();
      userStorage.remove();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const message =
      data?.mensagem || data?.message || data?.error || data?.detail || `Erro ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────
export const authApi = {
  /**
   * POST /auth/login
   * @param {string} username
   * @param {string} senha
   * @returns {{ token: string, user: object }}
   */
  async login(username, senha) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha }),
    });

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const message = data?.message || data?.error || 'Usuário ou senha inválidos';
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    const token = data?.token;
    if (!token) throw new Error('Token não recebido do servidor');

    // Decodifica o payload JWT para extrair o objeto funcionario
    let funcionario;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      funcionario = payload.funcionario;
    } catch {
      throw new Error('Erro ao processar autenticação');
    }

    tokenStorage.set(token);
    userStorage.set(funcionario);

    return { token, user: funcionario };
  },

  logout() {
    tokenStorage.remove();
    userStorage.remove();
  },

  isAuthenticated() {
    return !!tokenStorage.get();
  },

  getUser() {
    return userStorage.get();
  },
};

// ─────────────────────────────────────────────────────────────
//  RELATÓRIOS  (Financeiro)
// ─────────────────────────────────────────────────────────────
export const relatorioApi = {
  /**
   * GET /relatorio — parâmetros via query string (browser bloqueia GET+body)
   */
  listar({
    id, data_inicio, data_fim, funcionario_id, quarto_id,
    tipo_pagamento_id, registro, despesa_pessoal,
    page = 0, size = 10,
  } = {}) {
    const params = { page, size };
    if (id              !== undefined) params.id                = id;
    if (data_inicio)                   params.data_inicio       = data_inicio;
    if (data_fim)                      params.data_fim          = data_fim;
    if (funcionario_id)                params.funcionario_id    = funcionario_id;
    if (quarto_id)                     params.quarto_id         = quarto_id;
    if (tipo_pagamento_id)             params.tipo_pagamento_id = tipo_pagamento_id;
    if (registro)                      params.registro          = registro;
    if (despesa_pessoal !== undefined)  params.despesa_pessoal  = despesa_pessoal;
    return request('/relatorio', { params });
  },

  /** POST /relatorio — sempre multipart/form-data */
  criar(body, arquivo) {
    const fd = new FormData();
    fd.append('relatorio', new Blob([JSON.stringify(body)], { type: 'application/json' }), 'relatorio.json');
    if (arquivo) fd.append('arquivo', arquivo);
    return request('/relatorio', { method: 'POST', formData: fd });
  },

  /** GET /relatorio/{id} — busca completo (inclui desconto.uuid) */
  buscar(id) {
    return request(`/relatorio/${id}`);
  },

  /** PUT /relatorio — sempre multipart/form-data */
  atualizar(body, arquivo) {
    const fd = new FormData();
    fd.append('relatorio', new Blob([JSON.stringify(body)], { type: 'application/json' }), 'relatorio.json');
    if (arquivo) fd.append('arquivo', arquivo);
    return request('/relatorio', { method: 'PUT', formData: fd });
  },
};

// ─────────────────────────────────────────────────────────────
//  ARQUIVO
// ─────────────────────────────────────────────────────────────
export const arquivoApi = {
  /** Retorna a URL autenticada para download de um arquivo pelo path */
  downloadUrl(path) {
    const token = tokenStorage.get();
    const encoded = encodeURIComponent(path);
    return `${BASE_URL}/arquivo/download?path=${encoded}${token ? `&token=${token}` : ''}`;
  },

  /** Faz o download do arquivo como blob e abre em nova aba */
  async abrir(path) {
    const token = tokenStorage.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `${BASE_URL}/arquivo/download?path=${encodeURIComponent(path)}`,
      { headers },
    );
    if (!res.ok) throw new Error('Erro ao baixar arquivo');
    const contentType = res.headers.get('Content-Type') || 'application/octet-stream';
    const buffer = await res.arrayBuffer();
    const blob   = new Blob([buffer], { type: contentType });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.target     = '_blank';
    a.rel        = 'noreferrer';
    // Para PDFs abre no browser; para outros formatos força download
    if (!contentType.includes('pdf') && !contentType.includes('image')) {
      a.download = path.split(/[\\/]/).pop();
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────
export const enumApi = {
  /** GET /enum/tipo-pagamento -> [{ id, descricao }] */
  tipoPagamento() { return request('/enum/tipo-pagamento'); },
};

// ─────────────────────────────────────────────────────────────
//  QUARTOS
// ─────────────────────────────────────────────────────────────
export const quartoApi = {
  listar(params)     { return request('/quarto', { params }); },
  buscarPorId(id)    { return request(`/quarto/${id}`); },
  atualizar(id, body){ return request(`/quarto/${id}`, { method: 'PUT', body }); },
};

// ─────────────────────────────────────────────────────────────
//  APARTAMENTOS  (alias quartoApi)
// ─────────────────────────────────────────────────────────────
export const apartamentoApi = {
  listar(params)     { return quartoApi.listar(params); },
  buscarPorId(id)    { return quartoApi.buscarPorId(id); },
  atualizar(id, body){ return quartoApi.atualizar(id, body); },
};

// ─────────────────────────────────────────────────────────────
//  PERNOITES
// ─────────────────────────────────────────────────────────────
export const pernoiteApi = {
  listar(params)     { return request('/pernoites', { params }); },
  buscarPorId(id)    { return request(`/pernoites/${id}`); },
  criar(body)        { return request('/pernoites', { method: 'POST', body }); },
  atualizar(id, body){ return request(`/pernoites/${id}`, { method: 'PUT', body }); },
  encerrar(id)       { return request(`/pernoites/${id}/encerrar`, { method: 'POST' }); },
};

// ─────────────────────────────────────────────────────────────
//  DAY USE
// ─────────────────────────────────────────────────────────────
export const dayUseApi = {
  listar(params)     { return request('/dayuse', { params }); },
  buscarPorId(id)    { return request(`/dayuse/${id}`); },
  criar(body)        { return request('/dayuse', { method: 'POST', body }); },
  atualizar(id, body){ return request(`/dayuse/${id}`, { method: 'PUT', body }); },
  encerrar(id)       { return request(`/dayuse/${id}/encerrar`, { method: 'POST' }); },
};

// ─────────────────────────────────────────────────────────────
//  RESERVAS
// ─────────────────────────────────────────────────────────────
export const reservaApi = {
  listar(params)     { return request('/reservas', { params }); },
  buscarPorId(id)    { return request(`/reservas/${id}`); },
  criar(body)        { return request('/reservas', { method: 'POST', body }); },
  atualizar(id, body){ return request(`/reservas/${id}`, { method: 'PUT', body }); },
  cancelar(id)       { return request(`/reservas/${id}/cancelar`, { method: 'POST' }); },
};

// ─────────────────────────────────────────────────────────────
//  ITENS / INVENTÁRIO
// ─────────────────────────────────────────────────────────────
export const itemApi = {
  dashboard()            { return request('/item/dashboard'); },
  buscar(params)         { return request('/item/buscar', { params }); },
  criar(body)            { return request('/item', { method: 'POST', body }); },
  atualizar(id, body)    { return request(`/item/${id}`, { method: 'PUT', body }); },
  // POST /item/{id}/repor?quantidade=10&valorCompraUnidade=2.5&valorVendaUnidade=5&fornecedor=COCA
  repor(id, { quantidade, valorCompraUnidade, valorVendaUnidade, fornecedor }) {
    return request(`/item/${id}/repor`, { method: 'POST', params: { quantidade, valorCompraUnidade, valorVendaUnidade, fornecedor } });
  },
  // POST /item/{id}/consumir?quantidade=4
  consumir(id, { quantidade, quartoId, tipoPagamentoId, despesaPessoal }) {
    return request(`/item/${id}/consumir`, { method: 'POST', params: { quantidade, quartoId, tipoPagamentoId, despesaPessoal } });
  },
  historicoReposicao(id) { return request(`/item/${id}/historico-reposicao`); },
  historicoPreco(id)     { return request(`/item/${id}/historico-preco`); },
};

// ─────────────────────────────────────────────────────────────
//  CATEGORIAS
// ─────────────────────────────────────────────────────────────
export const categoriaApi = {
  // POST /categoria?categoria=nome&descricao=desc
  criar({ categoria, descricao }) {
    return request('/categoria', { method: 'POST', params: { categoria, descricao } });
  },
  // PUT /categoria/{id}?categoria=nome&descricao=desc
  atualizar(id, { categoria, descricao }) {
    return request(`/categoria/${id}`, { method: 'PUT', params: { categoria, descricao } });
  },
};

// ─────────────────────────────────────────────────────────────
//  CADASTROS (pessoas, empresas)
// ─────────────────────────────────────────────────────────────
export const cadastroApi = {
  // PESSOA – GET/POST/PUT /pessoa
  listarPessoas(params)     { return request('/pessoa', { params }); },
  criarPessoa(body)         { return request('/pessoa', { method: 'POST', body }); },
  atualizarPessoa(body)     { return request('/pessoa', { method: 'PUT', body }); },
  vincularTitular(body)     { return request('/pessoa/vincular-titular', { method: 'PUT', body }); },

  // EMPRESA – GET/POST/PUT /empresa
  listarEmpresas(params)    { return request('/empresa', { params }); },
  buscarEmpresaPorId(id)    { return request('/empresa', { params: { id } }); },
  criarEmpresa(body)        { return request('/empresa', { method: 'POST', body }); },
  atualizarEmpresa(body)    { return request('/empresa', { method: 'PUT', body }); },
  // ativo: true = vincular, false = desvincular
  vincularPessoa(body)      { return request('/empresa/vincular-pessoa', { method: 'PUT', body }); },

  buscarCEP(cep)            { return request(`/cep/${cep}`); },
  buscarCNPJ(cnpj)          { return request(`/cnpj/${cnpj}`); },
};

// ─────────────────────────────────────────────────────────────
//  PREÇOS
// ─────────────────────────────────────────────────────────────
export const precoApi = {
  listar(params)     { return request('/precos', { params }); },
  criar(body)        { return request('/precos', { method: 'POST', body }); },
  atualizar(id, body){ return request(`/precos/${id}`, { method: 'PUT', body }); },
  deletar(id)        { return request(`/precos/${id}`, { method: 'DELETE' }); },
};

// ─────────────────────────────────────────────────────────────
//  FUNCIONÁRIOS
// ─────────────────────────────────────────────────────────────
export const funcionarioApi = {
  listar(params)     { return request('/funcionario', { params }); },
  buscarPorId(id)    { return request(`/funcionario/${id}`); },
  criar(body)        { return request('/funcionario', { method: 'POST', body }); },
  atualizar(body)    { return request('/funcionario', { method: 'PUT', body }); },

  listarHistorico(funcionarioId) { return request(`/historico-funcionario?funcionarioId=${funcionarioId}`); },
  atualizarHistorico(id, body)   { return request(`/historico-funcionario/${id}`, { method: 'PUT', body }); },
  criarHistorico(body)           { return request(`/historico-funcionario`, { method: 'POST', body }); },

  listarRecebidos(historicoFuncionarioId) { return request(`/historico-recebidos-funcionario?historicoFuncionarioId=${historicoFuncionarioId}`); },

  async criarRecebido(recebidoData, arquivo) {
    const token = tokenStorage.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('recebido', new Blob([JSON.stringify(recebidoData)], { type: 'application/json' }), 'recebido.json');
    if (arquivo) {
      formData.append('arquivo', arquivo);
    }

    const res = await fetch(`${BASE_URL}/historico-recebidos-funcionario`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 204) return null;

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const message = data?.message || data?.error || data?.detail || `Erro ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  async atualizarRecebido(id, recebidoData, arquivo) {
    const token = tokenStorage.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('recebido', new Blob([JSON.stringify(recebidoData)], { type: 'application/json' }), 'recebido.json');
    if (arquivo) {
      formData.append('arquivo', arquivo);
    }

    const res = await fetch(`${BASE_URL}/historico-recebidos-funcionario/${id}`, {
      method: 'PUT',
      headers,
      body: formData,
    });

    if (res.status === 204) return null;

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const message = data?.message || data?.error || data?.detail || `Erro ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  downloadArquivo(filePath) {
    const token = tokenStorage.get();
    const encodedPath = encodeURIComponent(filePath);
    const url = `${BASE_URL}/arquivos/download?caminho=${encodedPath}`;
    if (token) {
      // Abrir em nova aba
      window.open(url, '_blank');
    } else {
      window.open(url, '_blank');
    }
  },
};

// ─────────────────────────────────────────────────────────────
//  USUÁRIOS
// ─────────────────────────────────────────────────────────────
export const usuarioApi = {
  bloquear(id, bloqueado) { return request(`/usuario/${id}/bloqueio`, { method: 'PATCH', body: { bloqueado } }); },
  atualizarCredenciais(id, body) { return request('/usuario/credenciais', { method: 'PATCH', body: { id, ...body } }); },
};

// ─────────────────────────────────────────────────────────────
//  CARGOS
// ─────────────────────────────────────────────────────────────
export const cargoApi = {
  // GET /cargo  — parâmetros como query string
  listar(params) { return request('/cargo', { params }); },
  // POST /cargo — Cargo.Request { descricao, telas:[{id}], permissoes:[{id}] }
  criar(body)   { return request('/cargo', { method: 'POST', body }); },
  // PUT /cargo  — Cargo.Update { id, descricao, telas:[{id}], permissoes:[{id}] }
  atualizar(body){ return request('/cargo', { method: 'PUT', body }); },
  // DELETE /cargo — Cargo.Id { id }
  deletar(id)   { return request('/cargo', { method: 'DELETE', body: { id } }); },

  // PATCH /cargo/vincular/telas — Cargo.Vincular { cargo:{id}, telas:[{id}], ativo }
  vincularTelas(cargoId, telaIds, ativo) {
    return request('/cargo/vincular/telas', {
      method: 'PATCH',
      body: { cargo: { id: cargoId }, telas: telaIds.map(id => ({ id })), ativo },
    });
  },
  // PATCH /cargo/vincular/permissoes — Permissao.Vincular { cargo:{id}, permissoes:[{id}], ativo }
  vincularPermissoes(cargoId, permIds, ativo) {
    return request('/cargo/vincular/permissoes', {
      method: 'PATCH',
      body: { cargo: { id: cargoId }, permissoes: permIds.map(id => ({ id })), ativo },
    });
  },

  // GET /cargo/telas → List<Objeto>
  listarTelas() { return request('/cargo/telas'); },
  // GET /cargo/permissoes?telaId= → List<Objeto>
  listarPermissoesPorTela(telaId) { return request('/cargo/permissoes', { params: { telaId } }); },
};

// ─────────────────────────────────────────────────────────────
//  TELAS / PERMISSÕES  (ADMIN)
// ─────────────────────────────────────────────────────────────
export const permissaoApi = {
  listarTelas()                    { return request('/telas'); },
  listarPermissoesPorTela(telaId)  { return request('/permissoes', { params: { telaId } }); },
};

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  resumo()   { return request('/dashboard/resumo'); },
  ocupacao() { return request('/dashboard/ocupacao'); },
};

// ─────────────────────────────────────────────────────────────
//  EXPORT DEFAULT  (legado – mantém compatibilidade)
// ─────────────────────────────────────────────────────────────
export default {
  auth:        authApi,
  relatorio:   relatorioApi,
  apartamento: apartamentoApi,
  quarto:      quartoApi,
  enum:        enumApi,
  pernoite:    pernoiteApi,
  dayUse:      dayUseApi,
  reserva:     reservaApi,
  item:        itemApi,
  categoria:   categoriaApi,
  cadastro:    cadastroApi,
  preco:       precoApi,
  funcionario: funcionarioApi,
  usuario:     usuarioApi,
  cargo:       cargoApi,
  permissao:   permissaoApi,
  dashboard:   dashboardApi,
};
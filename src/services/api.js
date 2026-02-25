// ─────────────────────────────────────────────────────────────
//  api.js  –  Serviço global de integração com o backend
//  Base URL: produção (Heroku) ou local via VITE_API_URL
// ─────────────────────────────────────────────────────────────

// const BASE_URL =
//   import.meta.env.VITE_API_URL ||
//   'https://saas-hotel-istoepousada-dc98593a88fc.herokuapp.com';

  const BASE_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080';

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
async function request(path, { method = 'GET', body, headers = {}, params } = {}) {
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
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // sem conteúdo (ex: 204 No Content)
  if (res.status === 204) return null;

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const message =
      data?.message || data?.error || data?.detail || `Erro ${res.status}`;
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
    // O backend retorna o Bearer token no header Authorization
    // e o payload do usuário no body.
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha }),
    });

    // Tenta extrair token do header primeiro, depois do body
    let token = res.headers.get('Authorization') || res.headers.get('authorization');
    if (token?.startsWith('Bearer ')) token = token.slice(7);

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const message = data?.message || data?.error || 'Usuário ou senha inválidos';
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    // Alguns backends retornam o token no body
    if (!token && data?.token) token = data.token;
    if (!token && data?.accessToken) token = data.accessToken;

    // Persiste sessão
    if (token) tokenStorage.set(token);
    if (data)  userStorage.set(data);

    return { token, user: data };
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
   * GET /relatorios
   * Todos os parâmetros são opcionais.
   */
  listar({
    id,
    dataInicio,
    dataFim,
    funcionarioId,
    quartoId,
    tipoPagamentoId,
    valores,       // 'ENTRADA' | 'SAIDA'
    despesaPessoal,
    page = 0,
    size = 10,
  } = {}) {
    return request('/relatorios', {
      params: {
        id, dataInicio, dataFim, funcionarioId,
        quartoId, tipoPagamentoId, valores, despesaPessoal,
        page, size,
      },
    });
  },

  /** POST /relatorios */
  criar(body) {
    return request('/relatorios', { method: 'POST', body });
  },

  /** PUT /relatorios/:id */
  atualizar(id, body) {
    return request(`/relatorios/${id}`, { method: 'PUT', body });
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
  listar(params)     { return request('/itens', { params }); },
  buscarPorId(id)    { return request(`/itens/${id}`); },
  criar(body)        { return request('/itens', { method: 'POST', body }); },
  atualizar(id, body){ return request(`/itens/${id}`, { method: 'PUT', body }); },
  deletar(id)        { return request(`/itens/${id}`, { method: 'DELETE' }); },
};

// ─────────────────────────────────────────────────────────────
//  CADASTROS (pessoas, empresas, veículos)
// ─────────────────────────────────────────────────────────────
export const cadastroApi = {
  listarPessoas(params)         { return request('/pessoa',  { params }); },
  buscarPessoaPorId(id)         { return request(`/pessoa/${id}`); },
  criarPessoa(body)             { return request('/pessoa',  { method: 'POST', body }); },
  atualizarPessoa(id, body)     { return request(`/pessoa/${id}`, { method: 'PUT', body }); },

  listarEmpresas(params)        { return request('/empresas', { params }); },
  buscarEmpresaPorId(id)        { return request(`/empresas/${id}`); },
  criarEmpresa(body)            { return request('/empresas', { method: 'POST', body }); },
  atualizarEmpresa(id, body)    { return request(`/empresas/${id}`, { method: 'PUT', body }); },
  vincularPessoa(empresaId, body){ return request(`/empresas/${empresaId}/pessoa`, { method: 'POST', body }); },

  listarVeiculos(params)        { return request('/veiculos', { params }); },

  buscarCEP(cep)                { return request(`/cep/${cep}`); },
  buscarCNPJ(cnpj)              { return request(`/cnpj/${cnpj}`); },
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
  atualizar(id, body){ return request(`/funcionario/${id}`, { method: 'PUT', body }); },
};

// ─────────────────────────────────────────────────────────────
//  CARGOS
// ─────────────────────────────────────────────────────────────
export const cargoApi = {
  listar(params)     { return request('/cargo', { params }); },
};

// ─────────────────────────────────────────────────────────────
//  PERMISSÕES / CARGOS  (ADMIN)
// ─────────────────────────────────────────────────────────────
export const permissaoApi = {
  listarCargos()          { return request('/cargos'); },
  buscarCargoPorId(id)    { return request(`/cargos/${id}`); },
  criarCargo(body)        { return request('/cargos', { method: 'POST', body }); },
  atualizarCargo(id, body){ return request(`/cargos/${id}`, { method: 'PUT', body }); },
  deletarCargo(id)        { return request(`/cargos/${id}`, { method: 'DELETE' }); },

  listarTelas()           { return request('/telas'); },
  listarPermissoes()      { return request('/permissoes'); },
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
  cadastro:    cadastroApi,
  preco:       precoApi,
  funcionario: funcionarioApi,
  cargo:       cargoApi,
  permissao:   permissaoApi,
  dashboard:   dashboardApi,
};
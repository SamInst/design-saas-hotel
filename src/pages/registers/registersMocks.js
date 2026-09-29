// ─────────────────────────────────────────────────────────────
// DADOS MOCKADOS — TEMPORÁRIO
//
// O back-end ainda não expõe estes campos, mas eles fazem parte do desenho da
// tela de Cadastro. Tudo aqui é derivado do id do registro (hash determinístico),
// então os valores não mudam entre renders nem entre sessões — mas NÃO são reais.
//
// Quando os endpoints existirem, apague este arquivo e troque as chamadas em
// RegistersPage.jsx pelos dados de verdade. Os pontos de uso estão marcados
// com o comentário `// MOCK`.
// ─────────────────────────────────────────────────────────────

/** Hash FNV-1a — mesma entrada, mesma saída, sempre. */
const seed = (chave) => {
  let h = 2166136261;
  const s = String(chave ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Item de uma lista, escolhido de forma estável pela chave. */
const escolhe = (chave, sal, lista) => lista[seed(`${chave}:${sal}`) % lista.length];

// ── Categoria do hóspede ─────────────────────────────────────
const CATEGORIAS = [
  { nome: 'Ouro',    tom: 'ouro'    },
  { nome: 'Prata',   tom: 'prata'   },
  { nome: 'Bronze',  tom: 'bronze'  },
  { nome: 'Regular', tom: 'regular' },
];

/** Categoria de fidelidade. // MOCK */
export const mockCategoria = (id) => escolhe(id, 'categoria', CATEGORIAS);

// ── Veículos ─────────────────────────────────────────────────
const VAGAS = ['A-12', 'A-04', 'B-07', 'B-15', 'C-02', 'C-09', 'Coberta 3', 'Descoberta 8'];

/** Vaga de estacionamento reservada ao veículo. // MOCK */
export const mockVaga = (placa) => escolhe(placa, 'vaga', VAGAS);

// ── Vínculo com empresa ──────────────────────────────────────
const CARGOS = [
  'Gerente de Projetos', 'Diretor Comercial', 'Analista de Vendas',
  'Coordenador de TI', 'Sócio-administrador', 'Consultor',
];
const FATURAMENTOS = ['Faturado', 'Pagamento direto', 'Reembolso', 'Convênio'];

/** Cargo, forma de faturamento e contato do financeiro. // MOCK */
export const mockVinculoEmpresa = (pessoaId, empresaId) => {
  const chave = `${pessoaId}-${empresaId}`;
  return {
    cargo:            escolhe(chave, 'cargo', CARGOS),
    faturamento:      escolhe(chave, 'faturamento', FATURAMENTOS),
    contatoFinanceiro: 'financeiro@empresa.com.br',
  };
};

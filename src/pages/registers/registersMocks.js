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

/** Inteiro em [min, max] a partir da chave + um sal (para variar por campo). */
const intEntre = (chave, sal, min, max) => min + (seed(`${chave}:${sal}`) % (max - min + 1));

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

// ── Resumo de hospedagens / valores ──────────────────────────
/**
 * Totais que apareceriam no topo do cadastro: quantas hospedagens, quantas
 * diárias somadas e quanto o hóspede já gastou. // MOCK
 */
export const mockResumoHospede = (id) => {
  const hospedagens = intEntre(id, 'hospedagens', 1, 9);
  const diarias     = hospedagens * intEntre(id, 'mediaDiarias', 2, 6);
  const totalGasto  = diarias * intEntre(id, 'ticket', 180, 620);
  return { hospedagens, diarias, totalGasto };
};

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

// ── Histórico de hospedagem ──────────────────────────────────
const QUARTOS = ['101', '102', '201', '202', '203', '301', '302'];
const MESES   = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtData = (d) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;

/**
 * Estadias passadas e a atual, da mais recente para a mais antiga.
 * A primeira fica "Em andamento" quando o hóspede está hospedado. // MOCK
 */
export const mockHistorico = (id, { hospedado = false } = {}) => {
  const { hospedagens } = mockResumoHospede(id);
  const hoje = new Date();

  return Array.from({ length: hospedagens }, (_, i) => {
    const diarias  = intEntre(id, `diarias${i}`, 1, 7);
    // cada estadia recua alguns meses em relação à anterior
    const recuo    = i === 0 ? 0 : intEntre(id, `recuo${i}`, 2, 8) * 30 * i;
    const checkin  = new Date(hoje);
    checkin.setDate(checkin.getDate() - recuo - (i === 0 ? intEntre(id, 'atual', 0, 3) : 0));
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + diarias);

    return {
      id:       `${id}-${i}`,
      quarto:   escolhe(id, `quarto${i}`, QUARTOS),
      checkin:  fmtData(checkin),
      checkout: fmtData(checkout),
      diarias,
      total:    diarias * intEntre(id, `valor${i}`, 180, 620),
      status:   i === 0 && hospedado ? 'Em andamento' : 'Finalizada',
    };
  });
};

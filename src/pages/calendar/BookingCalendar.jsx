import { useState, useCallback, useEffect, useRef, useMemo, Fragment, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  ChevronDown, Loader2, X, XCircle, Users, Search, CalendarDays, Bell, Check, FileDown, FileText, SlidersHorizontal, DollarSign, MoreVertical, UserX,
  CalendarCheck2, Tag, Clock, Crown, AlertTriangle, Building2,
} from 'lucide-react';
import { Button }        from '../../components/ui/Button';
import { Modal }         from '../../components/ui/Modal';
import { FormField, Input } from '../../components/ui/Input';
import { DatePicker }    from '../../components/ui/DatePicker';
import { TimePicker }    from '../../components/ui/TimePicker';
import { Notification }  from '../../components/ui/Notification';
import { PaymentModal }  from '../../components/ui/PaymentModal';
import { PriceAdjustmentModal, computeAdjustedTotal, describeAdjustment, novoPrecoToState } from '../../components/ui/PriceAdjustmentModal';
import { addDaysStr }        from './calendarMocks';
import { gerarVoucherReserva, ADJ_OBS_PREFIX } from './gerarVoucherReserva';
import { reservaApi, quartoApi, quartoCategoriApi, cadastroApi, enumApi, userStorage, orcamentoApi, hospedagemApi } from '../../services/api';
import { useCalendarSocket } from '../../hooks/useCalendarSocket';
import whatsappIcon from '../../assets/whatsapp.png';
import emailIcon    from '../../assets/gmail.png';
import icoPix           from '../../assets/pagamento/pix.png';
import icoCartao        from '../../assets/pagamento/cartao.png';
import icoDinheiro      from '../../assets/pagamento/dinheiro.png';
import icoTransferencia from '../../assets/pagamento/transferencia.png';
import icoLink          from '../../assets/pagamento/link.png';
import icoBoleto        from '../../assets/pagamento/boleto.png';
import styles from './BookingCalendar.module.css';
import { tr, locale } from '../../i18n';

// ─── Date helpers (backend uses "dd/MM/yyyy HH:mm", frontend uses "yyyy-MM-dd") ─
const parseBrDate = (s) => {
  if (!s) return '';
  const [dt] = s.split(' ');
  const [d, m, y] = dt.split('/');
  return `${y}-${m}-${d}`;
};
const toBrDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Status mapping (backend enums → frontend keys) ───────────────────────────
const mapStatus = (r) => {
  if (r.status) {
    const s = (r.status + '').toUpperCase();
    // ── Novos status (enum atualizado) ──────────────────────────
    if (s === 'ORCAMENTO')                              return 'orcamento';
    if (s === 'ORCAMENTO_CANCELADO')                    return 'cancelado';
    if (s === 'RESERVA_SOLICITADA')                     return 'solicitada';
    if (s === 'RESERVA_ATIVA')                          return 'confirmada';
    if (s === 'RESERVA_CANCELADA')                      return 'cancelado';
    if (s === 'RESERVA_AUSENTE')                        return 'ausente';
    if (s === 'PERNOITE_ATIVO')                         return 'hospedado';
    if (s === 'PERNOITE_CANCELADO')                     return 'cancelado';
    if (s === 'PERNOITE_FINALIZADO')                    return 'finalizado';
    if (s === 'PERNOITE_FINALIZADO_PAGAMENTO_PENDENTE') return 'finalizado';
    if (s === 'DAY_USE_SOLICITADO')                     return 'solicitada';
    if (s === 'DAY_USE_ATIVO')                          return 'hospedado';
    if (s === 'DAY_USE_CANCELADO')                      return 'cancelado';
    if (s === 'DAY_USE_FINALIZADO')                     return 'finalizado';
    if (s === 'DAY_USE_FINALIZADO_PAGAMENTO_PENDENTE')  return 'finalizado';
    if (s === 'DAY_USE_AUSENTE')                        return 'ausente';
    // ── Legado (compatibilidade com versão anterior) ──────────
    if (s === 'CANCELADO')  return 'cancelado';
    if (s === 'HOSPEDADO')  return 'hospedado';
    if (s === 'FINALIZADO') return 'finalizado';
    if (s === 'SOLICITADA') return 'solicitada';
    if (s === 'ATIVO')      return 'confirmada';
    return s.toLowerCase();
  }
  if (r.cancelado)          return 'cancelado';
  if (r.hospedado)          return 'hospedado';
  if (r.ativa === false)    return 'finalizado';
  return 'confirmada';
};

// Pagamentos do tipo "PENDENTE" são apenas um registro provisório (a forma real é
// definida depois). Servem para guardar uma informação/descrição e NÃO entram na
// soma do valor pago / card de preços.
const isPagamentoPendente = (forma) =>
  String(forma ?? '').trim().toUpperCase() === 'PENDENTE';

// ─── Normalize backend Reserva → frontend shape ───────────────────────────────
// API response: pessoas[i] = { id, pessoa: {id, nome, cpf, ...}, representante }
//               pagamentos[i] = { id, pagamento: {uuid, tipo_pagamento, nome_pagador, valor, ...} }
export const normalizeReserva = (r) => {
  // Unwrap nested pessoa objects. O titular (representante) vem sempre primeiro — ordena
  // defensivamente pela flag `titular` para não depender da ordem do backend.
  const pessoasRaw = r.pessoas ?? [];
  const pessoas    = pessoasRaw
    .map((p) => p.pessoa ?? p)
    .sort((a, b) => (b.titular === true ? 1 : 0) - (a.titular === true ? 1 : 0));
  const titular    = pessoas[0];

  // Unwrap nested pagamento objects
  const pagsRaw   = r.pagamentos ?? [];
  const pags      = pagsRaw.map((p) => p.pagamento ?? p);
  const totalPago = pags
    .filter((p) => !isPagamentoPendente(p.tipo_pagamento?.descricao ?? p.forma_pagamento))
    .reduce((s, p) => s + (p.valor ?? 0), 0);

  // Suporte a campos legados e novos nomes de data
  const dataEntrada   = r.data_hora_entrada   ?? r.data_hora_checkin  ?? '';
  const dataSaida     = r.data_hora_saida     ?? r.data_hora_checkout ?? '';
  // Suporte a quarto_id (orçamento) além de fk_quarto e quarto embedded
  const quartoId = r.quarto?.id ?? r.quarto_id ?? r.fk_quarto ?? (typeof r.quarto === 'number' ? r.quarto : null);

  return {
    id:                      r.id,
    quarto:                  quartoId,
    quartoId:                quartoId, // cópia explícita para uso em display
    categoria:               r.categoria?.nome ?? '',
    titularNome:             titular?.nome ?? r.orcamento_info?.nome_solicitante ?? r.nome_solicitante ?? r.titular_nome ?? tr('Hóspede'),
    empresaNome:             r.empresa?.nome_fantasia || r.empresa?.razao_social || r.empresa_nome || null,
    funcionario:             r.usuario?.pessoa?.nome ?? r.usuario?.nome ?? r.funcionario?.nome ?? null,
    dataHoraRegistro:        r.data_hora_registro ?? null,
    observacao:              r.observacao ?? null,
    quantidadeAcompanhantes: Math.max(0, pessoas.length - 1),
    dataInicio:              parseBrDate(dataEntrada),
    dataFim:                 parseBrDate(dataSaida),
    chegadaPrevista:         dataEntrada,
    saidaPrevista:           dataSaida,
    // Há meia diária (saída tardia na última diária)? Usado para o "meio ticket" no calendário.
    meiaDiaria:              (r.diarias ?? []).some((d) => d?.meia_diaria),
    // Diárias como estão gravadas: valor persistido (é o que foi cobrado) e a sazonalidade
    // que valeu naquela noite. É a fonte dos valores no card — não o /calcular-preco, que
    // devolveria o preço de hoje e não o da reserva.
    diarias: (r.diarias ?? []).map((d) => ({
      id:            d.id,
      numero:        d.numero ?? null,
      quartoId:      d.quarto?.id ?? null,
      checkin:       d.checkin  ?? '',
      checkout:      d.checkout ?? '',
      valor:         d.valor ?? 0,
      meiaDiaria:    !!d.meia_diaria,
      sazonalidade:  d.sazonalidade?.descricao ?? null,
      // "1 Adulto(s) + Criança de 5 anos (gratuidade)" e quanto do valor saiu das crianças
      ocupacao:      d.ocupacao?.descricao ?? null,
      valorCriancas: d.ocupacao?.valor_criancas ?? null,
    })),
    status:                  mapStatus(r),
    hospedes: pessoas.map((p) => ({
      id:            p.id,
      nome:          p.nome,
      cpf:           p.cpf ?? '',
      telefone:      p.celular ?? p.telefone ?? '',
      email:         p.email ?? '',
      dataNascimento: p.data_nascimento ?? '',
      titular:       p.titular === true,
    })),
    pagamentos: pagsRaw.map((entry) => {
      const p = entry.pagamento ?? entry;
      return {
        id:                  p.uuid ?? p.id,
        descricao:           p.descricao ?? '',
        formaPagamento:      p.tipo_pagamento?.descricao ?? p.forma_pagamento ?? '',
        nomePagador:         p.nome_pagador ?? '',
        valor:               p.valor ?? 0,
        cancelado:           p.cancelado ?? false,
        dataRegistro:        p.data_hora_registro ?? entry.data_hora_registro ?? '',
        funcionario:         p.funcionario?.nome ?? entry.funcionario?.nome ?? '',
        motivoCancelamento:  p.motivo_cancelamento?.motivo_cancelamento ?? null,
        dataMotivo:          p.motivo_cancelamento?.data_hora_registro ?? null,
        funcMotivo:          p.motivo_cancelamento?.funcionario?.nome ?? null,
        grupoId:             p.grupo_id ?? entry.grupo_id ?? null,
      };
    }),
    valorTotal: r.valor_total ?? 0,
    novoPreco: r.novo_preco ?? null,
    totalPago,
    motivoCancelamento: r.motivo_cancelamento?.motivo_cancelamento ?? null,
    dataMotivo:         r.motivo_cancelamento?.data_hora_registro   ?? null,
    funcMotivo:         r.motivo_cancelamento?.funcionario?.nome    ?? null,
    grupo_id: r.grupo_id ?? null,
    orcamentoInfo: r.orcamento_info ?? null,
    pessoasOrcamento: (r.pessoas_orcamento ?? []).map((p) => ({
      id:             p.id,
      nome:           p.nome,
      dataNascimento: p.data_nascimento ?? '',
    })),
    consumos: (r.consumos ?? [])
      .filter((c) => c && !c.cancelado)
      .map((c) => ({
        id:             c.id,
        descricao:      c.item?.descricao ?? tr('Item'),
        quantidade:     c.quantidade ?? 1,
        valorUnitario:  c.valor ?? 0,
        valorTotal:     (c.valor ?? 0) * (c.quantidade ?? 1),
        despesaPessoal: c.despesa_pessoal ?? false,
        data:           c.data_hora_registro ?? '',
      })),
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_CELL_W   = 185;
const ROOM_H       = 72;
const CAT_H        = 30;
const HDR_H        = 64;
const LEFT_W       = 86;
const LEFT_W_NARROW = 86;
const LEFT_W_MOBILE = 80;  // celular: só "Apt. 11" e a lotação
const BAR_INSET    = 3; // folga lateral da faixa flutuante
const VISIBLE_DAYS = 31;
const HALF         = DAY_CELL_W / 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalizeStr = (s) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const formatDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays   = (s, n) => addDaysStr(s, n);
const diffDays  = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const fmtRoom   = (n) => n != null ? String(n).padStart(2, '0') : '—';
const fmtDateBR = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmtCpf = (v) => { const d = (v || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : (v || ''); };
const calcAge = (dob) => {
  if (!dob) return null;
  // accepts yyyy-MM-dd or dd/MM/yyyy
  let y, m, d;
  if (dob.includes('/')) { [d, m, y] = dob.split('/'); } else { [y, m, d] = dob.split('-'); }
  const birth = new Date(+y, +m - 1, +d);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};
const diariasTxt = (n) => tr('{{n}} diária{{v1}}', { n, v1: n !== 1 ? 's' : '' });

/** Idade em uma data de referência (não hoje). Aceita yyyy-MM-dd ou dd/MM/yyyy. */
const idadeEm = (dob, ref) => {
  if (!dob || !ref) return null;
  let y, m, d;
  if (dob.includes('/')) { [d, m, y] = dob.split('/'); } else { [y, m, d] = dob.split('-'); }
  const birth = new Date(+y, +m - 1, +d);
  if (isNaN(birth)) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  if (ref.getMonth() < birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() < birth.getDate())) age--;
  return age;
};

/** Texto da ocupação no formato do /calcular-preco ("2 Adulto(s) + Criança de 5 anos"),
 *  montado a partir dos hóspedes. Só entra como reserva: a hospedagem já traz esse texto
 *  pronto por diária, inclusive marcando quais crianças são gratuidade — o que aqui não dá
 *  para saber, porque depende das regras de menores da categoria/sazonalidade. */
const ocupacaoTexto = (hospedes, dataInicioIso) => {
  const ref = dataInicioIso ? new Date(`${dataInicioIso}T00:00:00`) : new Date();
  let adultos = 0;
  const criancas = [];
  (hospedes ?? []).forEach((h) => {
    const idade = idadeEm(h.dataNascimento, ref);
    if (idade == null || idade >= 18) adultos += 1;
    else criancas.push(idade);
  });
  if (adultos === 0 && criancas.length === 0) return '';
  const sufixo =
    criancas.length === 0 ? ''
    : criancas.length === 1 ? tr(' + Criança de {{idade}} anos', { idade: criancas[0] })
    : tr(' + Crianças de {{idades}} anos', { idades: criancas.join(', ') });
  return tr('{{adultos}} Adulto(s){{sufixo}}', { adultos, sufixo });
};

/** Monta os `detalhes` do card a partir das diárias gravadas, no mesmo formato que o
 *  /calcular-preco devolve — descrição, sazonalidade e a parte das crianças vêm prontas do
 *  back-end, então o agrupamento e a sublinha funcionam iguais, sem requisição nenhuma. */
const detalhesDasDiarias = (diarias, hospedes, dataInicioIso) => {
  if (!diarias?.length) return [];
  const fallback = ocupacaoTexto(hospedes, dataInicioIso);
  const soData = (s) => (s || '').split(' ')[0];
  return diarias.map((d, i) => ({
    descricao: `Diaria ${d.numero ?? i + 1} - (${soData(d.checkin)} -> ${soData(d.checkout)}) `
      + (d.ocupacao ?? fallback),
    sazonalidade: d.sazonalidade ? { descricao: d.sazonalidade } : null,
    valor_final: d.valor ?? 0,
    valor_criancas: d.valorCriancas ?? null,
    meia_diaria: !!d.meiaDiaria,
  }));
};

/** Parte de hóspedes da descrição vinda de /calcular-preco, sem o trecho de datas:
 *  "Diaria 1 - (29/08/2026 -> 30/08/2026) 2 Adulto(s) + Criança de 10 anos"
 *  →  "2 Adulto(s) + Criança de 10 anos". */
const descricaoHospedes = (descricao) => {
  const m = /^\s*di[áa]ria\s*\d*\s*-\s*\([^)]*\)\s*(.*)$/i.exec(descricao ?? '');
  return (m ? m[1] : '').trim();
};

/** Trecho de datas da descrição: "29/08/2026 -> 30/08/2026". Identifica a noite,
 *  para casar a mesma diária antes e depois da edição mesmo quando o período muda. */
const periodoDiaria = (descricao) => {
  const m = /\(([^)]*)\)/.exec(descricao ?? '');
  return m ? m[1].trim() : '';
};

/** Agrupa as diárias de /calcular-preco em linhas únicas.
 *  Diárias com o mesmo valor, a mesma sazonalidade, os mesmos hóspedes e o mesmo
 *  acréscimo de crianças viram uma linha "3x R$ 120,00" — inclusive quando não são
 *  consecutivas, senão o mesmo valor se repete espalhado pela lista. A ordem é a da
 *  primeira ocorrência.
 *  valorDe: opcional, sobrescreve o valor exibido (modo "Por diária" do ajuste).
 *  _valorAnterior na diária: valor antes da edição em curso, exibido riscado. */
/** "2026-10-21" → "21/10" */
const fmtDiaMes = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');

/** "11/10/2026 15:09:04" → data em cima, hora embaixo. */
// Sazonalidades das diárias, fora da tabela: nome e as diárias afetadas.
function ResumoSazonalidade({ detalhes }) {
  const porSaz = new Map();
  detalhes.forEach((d, i) => {
    const nome = d.sazonalidade?.descricao;
    if (nome) porSaz.set(nome, [...(porSaz.get(nome) ?? []), String(i + 1).padStart(2, '0')]);
  });
  if (porSaz.size === 0) return null;
  return (
    <div className={styles.gdSazLista}>
      {[...porSaz].map(([nome, nums]) => (
        <div key={nome} className={styles.gdSaz}>
          <AlertTriangle size={14} className={styles.gdSazIco} />
          {tr('Sazonalidade aplicada:')}{' '}
          {nums.length === 1 ? tr('Diária {{n}}', { n: nums[0] }) : tr('Diárias {{n}}', { n: nums.join(', ') })}, “{nome}”
        </div>
      ))}
    </div>
  );
}

const fmtDataHoraPag = (valor) => {
  if (!valor) return '—';
  const [data, hora] = String(valor).split(/,?s+/);
  return hora ? `${data} · ${hora.slice(0, 5)}` : data;
};

// Pagamentos lançados na criação, na mesma tabela da view da reserva.
function TabelaPagamentosCriar({ lista, tiposPagamento, onRemover }) {
  const forma = (pg) => tiposPagamento.find((t) => t.id === pg.tipo_pagamento?.id)?.descricao ?? pg.tipo_pagamento?.descricao ?? '';
  return (
    <div className={styles.dtScroll}>
      <table className={styles.dtTable}>
        <thead><tr>
          <th>{tr('Forma de pagamento & data hora')}</th><th>{tr('Pagador')}</th><th className={styles.dtDir}>{tr('Valor')}</th><th />
        </tr></thead>
        <tbody>
          {lista.map((pg) => (
            <tr key={pg._localId}>
              <td>
                <span className={styles.dtForma}>
                  <span className={styles.finPgIcon}>{iconePagamento(forma(pg))}</span>
                  <span>
                    <span className={styles.dtCelTit}>{forma(pg) || pg.descricao || tr('Pagamento')}</span>
                    <span className={styles.dtCelSub}>{pg._criadoEm || '—'}</span>
                  </span>
                </span>
              </td>
              <td className={[styles.dtQuebra, styles.dtPagador].join(' ')}>{pg.nome_pagador || '—'}</td>
              <td className={[styles.dtDir, styles.dtValor].join(' ')}>{fmtBRL(pg.valor)}</td>
              <td className={styles.gdAcaoCel}>
                <button type="button" className={[styles.rvSecBtn, styles.rvSecBtnPerigo].join(' ')} onClick={() => onRemover(pg)}>
                  {tr('Remover')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Hóspedes do resumo da criação: o titular numa tabela própria, acima dos acompanhantes.
function HospedesResumo({ lista, rotuloTitular = tr('Titular') }) {
  const idade = (h) => { const a = calcAge(h.dataNascimento); return a == null ? null : tr('{{idade}} anos', { idade: a }); };
  const tabela = (titulo, itens) => (
    <div className={styles.dtScroll}>
      <table className={[styles.dtTable, styles.hospTabela].join(' ')}>
        <thead><tr><th>{titulo}</th><th>{tr('CPF')}</th><th className={styles.dtDir}>{tr('Idade')}</th></tr></thead>
        <tbody>
          {itens.map((h, i) => (
            <tr key={h.id ?? i}>
              <td className={styles.dtQuebra}><span className={styles.dtCelTit}>{h.nome}</span></td>
              <td>{h.cpf ? fmtCpf(h.cpf) : '—'}</td>
              <td className={styles.dtDir}>{idade(h) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className={styles.hospTabelas}>
      {tabela(rotuloTitular, lista.slice(0, 1))}
      {lista.length > 1 && tabela(tr('Acompanhantes'), lista.slice(1))}
    </div>
  );
}

function DataHora({ valor }) {
  if (!valor) return '—';
  const [data, hora] = String(valor).split(' ');
  return (
    <span className={styles.dtDataHora}>
      {data}
      {hora && <small>{hora.slice(0, 5)}</small>}
    </span>
  );
}

const iconePagamento = (desc) => {
  const d = (desc ?? '').toUpperCase();
  const src = d.includes('PIX') ? icoPix
    : /CART|CR[EÉ]DITO|D[EÉ]BITO/.test(d) ? icoCartao
    : /DINHEIRO|ESP[EÉ]CIE/.test(d) ? icoDinheiro
    : /TRANSFER|TED|DOC/.test(d) ? icoTransferencia
    : /LINK/.test(d) ? icoLink
    : icoBoleto;
  return <img src={src} alt="" draggable={false} />;
};

const groupDiarias = (detalhes, valorDe) => {
  const grupos = [];
  const porChave = new Map();
  (detalhes || []).forEach((d, i) => {
    const valor    = valorDe ? valorDe(d) : (d.valor_final ?? 0);
    const original = d.valor_final ?? 0;
    const saz      = d.sazonalidade?.descricao ?? '';
    const criancas = d.valor_criancas > 0 ? d.valor_criancas : 0;
    const anterior = d._valorAnterior ?? null;
    const hosp     = descricaoHospedes(d.descricao);
    // Meia diária (saída tardia) nunca se junta a uma diária inteira, nem que o valor coincida.
    const meia     = d.meia_diaria === true;
    const key      = [valor, original, saz, criancas, anterior ?? '', hosp, meia ? 'M' : 'F'].join('|');
    const atual    = porChave.get(key);
    if (atual) { atual.qtd += 1; atual.numeros.push(i + 1); return; }
    const g = { key, qtd: 1, numeros: [i + 1], valor, valorOriginal: original, saz, criancas, anterior, hosp, meia,
      valorAdultos: original - criancas };
    porChave.set(key, g);
    grupos.push(g);
  });
  return grupos;
};

/** "2 Adulto(s)" → "2 Adultos"; "1 Adulto(s)" → "1 Adulto". */
const normalizaAdultos = (txt) =>
  txt.replace(/adulto\(s\)|adult\(s\)/gi, parseInt(txt, 10) === 1 ? tr('Adulto') : tr('Adultos'));

/** Sublinha da diária:
 *    "PREÇO ALTO NO DOMINGO - 2 Adultos (R$ 190,00) + Criança de 10 anos (R$ 50,00)"
 *    sem criança:       "PREÇO ALTO NO DOMINGO - 2 Adultos"
 *    sem sazonalidade:  "2 Adultos"
 *  Os valores só entram quando há criança — sem ela o total da linha já é o dos
 *  adultos. O valor dos adultos é o que sobra do total depois das crianças, então
 *  as duas partes sempre somam o valor da diária (acréscimo de sazonalidade
 *  incluído). O back-end informa um único valor_criancas, que cobre todas elas. */
const diariaSubs = (g, guestLabel) => {
  const base = g.hosp || guestLabel || '';
  if (!base) return g.saz;
  const partes   = base.split('+').map((p) => p.trim()).filter(Boolean);
  const adultos  = normalizaAdultos(partes[0] ?? '');
  const criancas = partes.slice(1);
  const hospedes = (g.criancas > 0 && criancas.length > 0)
    ? `${adultos} (${fmtBRL(g.valorAdultos)}) + ${criancas.join(' + ')} (${fmtBRL(g.criancas)})`
    : [adultos, ...criancas].join(' + ');
  return g.saz ? `${g.saz} - ${hospedes}` : hospedes;
};

/** Converts a guest list to { datas_nascimento } for /calcular-preco.
 *  One birth date per guest in dd/MM/yyyy — guests without a stored date get a default adult date (18 years ago). */
const buildGuestCalcParams = (guests) => {
  if (!guests.length) return {};
  const today = new Date();
  const defaultAdult = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear() - 18}`;
  const datas_nascimento = guests.map((h) => {
    if (!h.dataNascimento) return defaultAdult;
    // ISO yyyy-MM-dd → dd/MM/yyyy
    return /^\d{4}-\d{2}-\d{2}$/.test(h.dataNascimento)
      ? h.dataNascimento.split('-').reverse().join('/')
      : h.dataNascimento; // already dd/MM/yyyy
  });
  return { datas_nascimento };
};

const initials = (nome) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const STATUS_LABEL = {
  hospedado: tr('Hospedado'), confirmada: tr('Reservado'),
  solicitada: tr('Solicitada'), finalizado: tr('Finalizado'), cancelado: tr('Cancelado'),
  orcamento: tr('Orçamento'),
};

const GRUPO_PALETTE = [
  'oklch(0.64 0.12 232)', 'oklch(0.63 0.2 26)',  'oklch(0.5 0.21 274)',  'oklch(0.66 0.14 162)',
  'oklch(0.7 0.15 72)',   'oklch(0.52 0.18 305)', 'oklch(0.58 0.18 350)', 'oklch(0.55 0.1 200)',
];
const grupoColor = (grupoId) => GRUPO_PALETTE[Number(grupoId) % GRUPO_PALETTE.length];


// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal open onClose={onCancel} size="sm" title={title}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onCancel}>{tr('Cancelar')}</Button>
          <Button variant="primary"   onClick={onConfirm}>{tr('Confirmar')}</Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{message}</p>
    </Modal>
  );
}

// Carregamento em esqueleto: a forma do conteúdo aparece antes dos dados.
function Esqueleto({ linhas = 5, avatar = true }) {
  return (
    <div className={styles.skLista} aria-busy="true" aria-label={tr('Carregando...')}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.skLinha}>
          {avatar && <span className={[styles.sk, styles.skAvatar].join(' ')} />}
          <span className={styles.skTextos}>
            <span className={styles.sk} style={{ width: `${64 - (i % 3) * 12}%` }} />
            <span className={[styles.sk, styles.skFino].join(' ')} style={{ width: `${42 - (i % 2) * 12}%` }} />
          </span>
          {avatar && <span className={[styles.sk, styles.skTag].join(' ')} />}
        </div>
      ))}
    </div>
  );
}

function EsqueletoGrade({ leftW }) {
  return (
    <div className={styles.skGrade} style={{ '--lw': `${leftW}px` }} aria-busy="true" aria-label={tr('Carregando...')}>
      <div className={styles.skGradeTopo}>
        <span className={styles.skGradeCanto} />
        <span className={styles.skGradeDias}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={styles.skGradeDia}>
              <span className={styles.sk} style={{ width: '58%' }} />
              <span className={[styles.sk, styles.skFino].join(' ')} style={{ width: '30%' }} />
            </span>
          ))}
        </span>
      </div>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={[styles.skGradeLinha, i % 4 === 0 ? styles.skGradeCat : ''].join(' ')}>
          <span className={styles.skGradeQuarto}>
            <span className={[styles.sk, styles.skEscuro].join(' ')} style={{ width: i % 4 === 0 ? '80%' : '62%' }} />
          </span>
          <span className={styles.skGradeCelulas}>
            {i % 4 !== 0 && (
              <span className={[styles.sk, styles.skBarra].join(' ')}
                style={{ left: `${(i * 23) % 55}%`, width: `${16 + (i * 37) % 26}%` }} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// No desktop as janelas abrem na box da direita, por cima do calendário.
const JanelaCtx = createContext(null);
// Box da direita, mesmo quando a lista vive na esquerda (grupos, orçamentos, dia, quarto).
const JanelaDirCtx = createContext(null);

// Conteúdo de um item da lista da esquerda, no desenho da view da reserva.
function GavetaDir({ classe = '', children, footer = null }) {
  const dir = useContext(JanelaDirCtx);
  if (!dir) return null;
  return createPortal(
    <div className={[styles.rvGaveta, styles.rvGavetaLista, classe].join(' ')}>
      <div className={styles.rvPainelCorpo}>{children}</div>
      {footer && <div className={styles.rvPainelRodape}>{footer}</div>}
    </div>,
    dir,
  );
}

// Ação da criação (pagamento, desconto): gaveta à esquerda da gaveta de criação.
// Aceita as props de um Modal para servir de "as" do PriceAdjustmentModal.
function GavetaLado({ open = true, onClose, title, footer, children, size, ...modal }) {
  const dir = useContext(JanelaDirCtx);
  if (!dir) return <Modal open={open} onClose={onClose} title={title} footer={footer} size={size} {...modal}>{children}</Modal>;
  if (!open) return null;
  return createPortal(
    <div className={[styles.rvGavetaCriar, styles.gavetaLado].join(' ')}>
      <header className={styles.janelaHead}>
        <div className={styles.janelaTit}>{title}</div>
        <button type="button" className={styles.rcCloseBtn} onClick={onClose} aria-label={tr('Fechar')}>
          <X size={17} />
        </button>
      </header>
      <div className={styles.criarCorpo}>{children}</div>
      {footer && <div className={[styles.criarRodape, styles.gavetaLadoRodape].join(' ')}>{footer}</div>}
    </div>,
    dir,
  );
}

// Nova reserva / novo orçamento: gaveta à direita, como a view da reserva.
function JanelaGaveta({ open, onClose, title, children, footer, bodyStyle, criando = false, criandoTxt = '', ...modal }) {
  const dir = useContext(JanelaDirCtx);
  if (!dir) return <Modal open={open} onClose={onClose} title={title} footer={footer} bodyStyle={bodyStyle} {...modal}>{children}</Modal>;
  if (!open) return null;
  return createPortal(
    <div className={styles.rvGavetaCriar}>
      <header className={styles.janelaHead}>
        <div className={styles.janelaTit}>{title}</div>
        <button type="button" className={styles.rcCloseBtn} onClick={onClose} aria-label={tr('Fechar')}>
          <X size={17} />
        </button>
      </header>
      <div className={styles.criarCorpo}>{children}</div>
      {footer && <div className={styles.criarRodape}>{footer}</div>}
      {criando && (
        <div className={styles.criandoVeu} role="status" aria-live="polite">
          <div className={styles.criandoCard}>
            <span className={styles.criandoAnel} />
            <b>{criandoTxt || tr('Criando reserva…')}</b>
            <small>{tr('Reservando o quarto no calendário')}</small>
            <span className={styles.criandoBarra}><i /></span>
          </div>
        </div>
      )}
    </div>,
    dir,
  );
}

function CabecalhoGaveta({ titulo, chips = [], meta, onClose }) {
  return (
    <div className={styles.rcHead}>
      <div className={styles.rcHeadLeft}>
        <div className={styles.rcHeadTop}>
          <span className={styles.rcTitle}>{titulo}</span>
          {chips.filter(Boolean).map((c, i) => (
            <span key={i} className={[styles.rcChip, c.red ? styles.rcChipRed : ''].join(' ')}>{c.txt ?? c}</span>
          ))}
        </div>
        {meta && <span className={styles.rcHeadMeta}>{meta}</span>}
      </div>
      <div className={styles.rcHeadRight}>
        <button type="button" className={styles.rcCloseBtn} onClick={onClose} aria-label={tr('Fechar')}>
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

function FaixaPeriodo({ inicio, fim, celulas = [], opcoes = null }) {
  return (
    <div className={[styles.rcSection, styles.rvDestaque].join(' ')}>
      <div className={[styles.rcPeriodRow, styles.rvPeriodRowFull].join(' ')}>
        <div className={styles.ovDateCell}>
          <div className={styles.ovDateLabel}>{tr('Check-in')}</div>
          <div className={styles.ovDateValue}>{inicio ? fmtDateBR(inicio) : '—'}</div>
        </div>
        <div className={styles.ovDateArrow}><ChevronRight size={16} /></div>
        <div className={[styles.ovDateCell, styles.ovDateCellRight].join(' ')}>
          <div className={styles.ovDateLabel}>{tr('Check-out')}</div>
          <div className={styles.ovDateValue}>{fim ? fmtDateBR(fim) : '—'}</div>
        </div>
        {celulas.map(([n, rot], i) => (
          <div key={i} className={styles.ovNightsCell}>
            <div className={styles.ovNightsNum}>{n}</div>
            <div className={styles.ovNightsLabel}>{rot}</div>
          </div>
        ))}
        {opcoes}
      </div>
    </div>
  );
}

// Opções no rodapé da gaveta, no desenho do rodapé da view da reserva.
function RodapeOpcoes({ itens }) {
  const [aberto, setAberto] = useState(false);
  const btnRef = useRef(null);
  const lista = itens.filter(Boolean);
  if (lista.length === 0) return null;
  return (
    <div className={styles.rvRodape}>
      <div className={styles.rvRodapeMais}>
        {aberto && (
          <>
            <div className={styles.rvAcoesBackdrop} onClick={() => setAberto(false)} />
            <div className={styles.rvRodapeMenu} role="menu">
              {lista.map((a, i) => (
                <Fragment key={i}>
                  {a.divider && <div className={styles.rvAcoesDiv} />}
                  <button type="button" disabled={a.disabled} title={a.title}
                    className={[styles.rvAcoesItem, a.danger ? styles.rvAcoesItemDanger : ''].join(' ')}
                    onClick={(e) => { setAberto(false); a.onClick(e, btnRef.current); }}>
                    {a.icon} {a.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}
        <button ref={btnRef} type="button" className={styles.rvRodapeBtn} onClick={() => setAberto((v) => !v)}
          aria-haspopup="menu" aria-expanded={aberto}>
          {tr('Opções')} <ChevronDown size={15} className={aberto ? styles.rvAcoesBtnChevronOpen : styles.rvAcoesBtnChevron} />
        </button>
      </div>
    </div>
  );
}

function MenuOpcoes({ itens }) {
  const [aberto, setAberto] = useState(false);
  const lista = itens.filter(Boolean);
  if (lista.length === 0) return null;
  return (
    <div className={styles.rvOpcoesCell}>
      <div className={styles.rvAcoesWrap}>
        {aberto && (
          <>
            <div className={styles.rvAcoesBackdrop} onClick={() => setAberto(false)} />
            <div className={styles.rvAcoesMenu}>
              <div className={styles.rvAcoesTit}>{tr('Opções')}</div>
              {lista.map((a, i) => (
                <Fragment key={i}>
                  {a.divider && <div className={styles.rvAcoesDiv} />}
                  <button type="button" disabled={a.disabled} title={a.title}
                    className={[styles.rvAcoesItem, a.primary ? styles.rvAcoesItemPrimary : '', a.danger ? styles.rvAcoesItemDanger : ''].join(' ')}
                    onClick={(e) => { setAberto(false); a.onClick(e); }}>
                    {a.icon} {a.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        )}
        <button type="button" className={styles.rvAcoesBtn} onClick={() => setAberto((v) => !v)}>
          {tr('Opções')} <ChevronDown size={15} className={aberto ? styles.rvAcoesBtnChevronOpen : styles.rvAcoesBtnChevron} />
        </button>
      </div>
    </div>
  );
}

function LinhaReserva({ r, onClick, mostrarQuarto = true }) {
  const dias     = diffDays(r.dataInicio, r.dataFim);
  const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
  return (
    <button type="button" className={[styles.lstRow, r.status === 'finalizado' ? styles.lstRowFeito : ''].join(' ')} onClick={onClick}>
      {mostrarQuarto && <span className={styles.lstNum}>{fmtRoom(r.quarto)}</span>}
      <span className={styles.lstTxt}>
        <b>{r.titularNome}</b>
        <small>{fmtDiaMes(r.dataInicio)} → {fmtDiaMes(r.dataFim)} · {diariasTxt(dias)} · {nPessoas} {tr('pessoa')}{nPessoas !== 1 ? 's' : ''}</small>
      </span>
      {r.status !== 'confirmada' && <span className={[styles.dtStatus, styles[`dtStatus_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status] ?? r.status}</span>}
      <ChevronRight size={15} className={styles.sideSeta} />
    </button>
  );
}

function SecaoTabela({ titulo, colunas, vazio, children, temLinhas }) {
  return (
    <div className={styles.rcSection}>
      <div className={styles.rcSectionHead}>
        <span className={styles.rcSectionLabel}>{titulo}</span>
      </div>
      <div className={styles.dtScroll}>
        <table className={styles.dtTable}>
          <thead><tr>
            {colunas.map(([c, dir], i) => <th key={i} className={dir === 'centro' ? styles.dtCentro : dir ? styles.dtDir : undefined}>{c}</th>)}
          </tr></thead>
          <tbody>
            {temLinhas ? children : (
              <tr><td colSpan={colunas.length} className={styles.dtVazio}>{vazio}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Janela({ open, onClose, title, acaoTopo = null, children, footer, bodyStyle, hideHeader, ...modal }) {
  const slot = useContext(JanelaCtx);
  if (!slot) {
    return <Modal open={open} onClose={onClose} title={acaoTopo ? <>{title}<span style={{ marginLeft: 'auto' }}>{acaoTopo}</span></> : title} footer={footer} bodyStyle={bodyStyle} hideHeader={hideHeader} {...modal}>{children}</Modal>;
  }
  if (!open) return null;
  return createPortal(
    <section className={styles.janela}>
      {(!hideHeader || title) && (
        <header className={styles.janelaHead}>
          <button type="button" className={styles.janelaVoltar} onClick={onClose}
            title={tr('Voltar ao calendário')} aria-label={tr('Voltar ao calendário')}>
            <ChevronLeft size={17} />
          </button>
          <div className={styles.janelaTit}>{title}</div>
          {acaoTopo}
        </header>
      )}
      <div className={styles.janelaCorpo} style={bodyStyle}>{children}</div>
      {footer && <footer className={styles.janelaRodape}>{footer}</footer>}
    </section>,
    slot,
  );
}

// Balão flutuante de decisão, preso ao elemento que o abriu: acima dele, alinhado à
// direita (ou abaixo, sem espaço em cima). Vai por portal (position: fixed) para não ser
// cortado por tabelas com rolagem. Fecha ao clicar fora ou com Esc.
const alvoDe = (x) => x?.currentTarget ?? (x instanceof Element ? x : null);

function Balao({ anchor, onClose, children }) {
  const [pos, setPos] = useState(null);
  const balaoRef = useRef(null);

  useEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const right = Math.max(8, window.innerWidth - r.right);
      setPos(r.top < 220
        ? { right, top: r.bottom + 8, abaixo: true }
        : { right, bottom: window.innerHeight - r.top + 8, abaixo: false });
    };
    const fora = (e) => {
      if (anchor.contains(e.target) || balaoRef.current?.contains(e.target)) return;
      onClose();
    };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc, true);
    };
  }, [anchor, onClose]);

  if (!pos) return null;
  return createPortal(
    <div ref={balaoRef} role="dialog" className={[styles.balao, pos.abaixo ? styles.balaoAbaixo : ''].join(' ')}
      style={{ right: pos.right, top: pos.top, bottom: pos.bottom }}>
      {children}
    </div>,
    document.body,
  );
}

// Botões do pé do balão: "Cancelar" fecha, o outro confirma.
function BalaoAcoes({ onCancelar, confirmar, perigo = false, disabled = false, onConfirmar, cancelarTxt }) {
  return (
    <div className={styles.balaoAcoes}>
      <button type="button" className={styles.balaoBtn} onClick={onCancelar}>{cancelarTxt ?? tr('Cancelar')}</button>
      <button type="button" className={[styles.balaoBtn, perigo ? styles.balaoBtnPerigo : styles.balaoBtnOk].join(' ')}
        disabled={disabled} onClick={onConfirmar}>
        {confirmar}
      </button>
    </div>
  );
}

// Botão de decisão com confirmação num balão logo acima dele — sem modal.
function BalaoConfirma({ label, mensagem, confirmar, perigo = false, className, onConfirm }) {
  const [anchor, setAnchor] = useState(null);
  const fechar = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button type="button" className={className} aria-expanded={!!anchor}
        onClick={(e) => { const el = e.currentTarget; setAnchor((a) => (a ? null : el)); }}>
        {label}
      </button>
      {anchor && (
        <Balao anchor={anchor} onClose={fechar}>
          <p className={styles.balaoMsg}>{mensagem}</p>
          <BalaoAcoes onCancelar={fechar} confirmar={confirmar} perigo={perigo}
            onConfirmar={() => { fechar(); onConfirm(); }} />
        </Balao>
      )}
    </>
  );
}

// No desktop o detalhe da reserva abre numa gaveta à direita, por cima do calendário.
function PainelReserva({ inline, acao = false, pag = false, estreito = false, diarias = false, largo = false, naView = false, pagamentos = false, fecharX = false, saindo = false, lateral = null, footer, children, ...modal }) {
  const slot = useContext(JanelaCtx);
  if (!inline || !slot) return <Modal {...modal} footer={footer}>{children}</Modal>;
  return createPortal(
    <div className={[styles.rvGaveta, acao ? styles.rvGavetaAcao : styles.rvGavetaReserva, naView ? styles.rvGavetaNaView : '', pagamentos ? styles.rvGavetaPagamentos : '', pag ? styles.rvGavetaPag : '', estreito ? styles.rvGavetaEstreita : '', diarias ? styles.rvGavetaDiarias : '', largo ? styles.rvGavetaLarga : '', saindo ? styles.rvGavetaSai : ''].join(' ')}>
      {modal.title && !modal.hideHeader && (
        <header className={styles.janelaHead}>
          {!fecharX && (
            <button type="button" className={styles.janelaVoltar} onClick={modal.onClose}
              title={tr('Voltar')} aria-label={tr('Voltar')}>
              <ChevronLeft size={17} />
            </button>
          )}
          <div className={styles.janelaTit}>{modal.title}</div>
          {fecharX && (
            <button type="button" className={styles.rcCloseBtn} onClick={modal.onClose} aria-label={tr('Fechar')}>
              <X size={17} />
            </button>
          )}
        </header>
      )}
      <div className={styles.rvPainelCorpo}>{children}</div>
      {footer && <div className={styles.rvPainelRodape}>{footer}</div>}
      {lateral && <div className={styles.rvFlutuante}>{lateral}</div>}
    </div>,
    slot,
  );
}

const PainelAcaoReserva = (props) => <PainelReserva inline acao {...props} />;

// ─── Reserva Detail Modal ─────────────────────────────────────────────────────
// `overnight` — quando informado, o modal opera em modo "pernoite" (Recepção):
//   muda apenas os botões do menu Ações e usa as diárias/dados fornecidos no objeto.
//   { diariasDetalhes, onAdicionarConsumo, onGerenciarDiarias, onFinalizar,
//     onAcionarLimpeza, onGerenciarPagamentos, onGerenciarPessoas, onGerenciarPreco,
//     onVoucher, onCancelar }
export function ReservaModal({ reserva, onClose, onCancel, onActivate, onMoverPernoite, onUpdate, onSync, onNotify, categorias, tiposPagamento, roomDescMap = {}, dragValues = null, onApprove, onReject, onAusente, reservas = [], overnight = null, limpeza = null, allowHospedarAnytime = false, groupInfo = null, onVoucherGrupo = null, inline = false, saindo = false }) {
  const isOvernight = !!overnight;
  // Botão "Finalizar Limpeza" — compartilhado entre pernoite (overnight) e reserva.
  // Em pernoite vem de overnight.hasLimpeza; em reserva vem da prop `limpeza`.
  const limpezaBtnInfo = (overnight?.hasLimpeza && overnight.onFinalizarLimpeza)
    ? { responsavel: overnight.limpezaResponsavel, onFinalizar: overnight.onFinalizarLimpeza }
    : (limpeza?.onFinalizar ? limpeza : null);
  // ── Edit mode ──────────────────────────────────────────────────────────────
  // dragValues: { quarto, checkin (yyyy-MM-dd), checkout (yyyy-MM-dd) } — set when opened from drag/resize
  const [editing,      setEditing]      = useState(dragValues !== null);
  const [editQuarto,   setEditQuarto]   = useState(dragValues ? [String(dragValues.quarto)] : [String(reserva.quarto)]);
  const [editCheckin,  setEditCheckin]  = useState(dragValues ? new Date(dragValues.checkin + 'T00:00:00') : new Date(reserva.dataInicio + 'T00:00:00'));
  const [editCheckout, setEditCheckout] = useState(dragValues ? new Date(dragValues.checkout + 'T00:00:00') : new Date(reserva.dataFim + 'T00:00:00'));

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dados');

  // ── Pending ops + dirty tracking ───────────────────────────────────────────
  // Each op: { type: 'addPessoa'|'removePessoa'|'addPagamento'|'cancelPagamento', ...data }
  const [pendingOps,   setPendingOps]   = useState([]);
  const [pagRegistrado, setPagRegistrado] = useState(null);
  const [hasChanges,   setHasChanges]   = useState(false);
  const [showDiscard,  setShowDiscard]  = useState(false);
  const [saving,       setSaving]       = useState(false);

  const addOp = (op) => {
    setPendingOps((prev) => [...prev, op]);
    setHasChanges(true);
  };

  const handleClose = (e) => {
    if (hasChanges) {
      const anchor = alvoDe(e);
      if (anchor) setBalao({ tipo: 'descartarFechar', anchor }); else setShowDiscard(true);
      return;
    }
    onClose();
  };

  const handleDiscard = () => {
    setShowDiscard(false);
    onClose();
  };

  // ── Pessoas ────────────────────────────────────────────────────────────────
  const [pessoas,         setPessoas]         = useState(reserva.hospedes ?? []);
  const [pessoaQuery,     setPessoaQuery]     = useState('');
  const [pessoaResults,   setPessoaResults]   = useState([]);
  const [pessoaSearching, setPessoaSearching] = useState(false);
  const [showAddPessoa,   setShowAddPessoa]   = useState(false);
  const [pendingPessoa,   setPendingPessoa]   = useState(null); // { titular, selected: Set<id> }
  const pessoaTimerRef = useRef(null);

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  const [pagamentos,     setPagamentos]     = useState(reserva.pagamentos ?? []);
  const [showPayModal,   setShowPayModal]   = useState(false);
  const [cancelPagId,    setCancelPagId]    = useState(null);
  const [cancelMotivo,   setCancelMotivo]   = useState('');
  const [viewPagamento,      setViewPagamento]      = useState(null);
  const [confirmPernoite,    setConfirmPernoite]    = useState(false);
  // Decisões da tela em balão sobre o próprio botão: { tipo, anchor, ... }
  const [balao, setBalao] = useState(null);
  const fecharBalao = useCallback(() => setBalao(null), []);
  const setaRef = useRef(null);
  const [confirmAusente,     setConfirmAusente]     = useState(false);
  const [confirmCancel,      setConfirmCancel]      = useState(false);
  const [confirmCancel2,     setConfirmCancel2]     = useState(false);
  const [cancelMotivRes,     setCancelMotivRes]     = useState('');
  const [confirmRemovePessoa, setConfirmRemovePessoa] = useState(null); // { id, nome }
  const pessoaWrapRef = useRef(null);
  const pessoaDropRef = useRef(null);
  const [pessoaDropStyle, setPessoaDropStyle] = useState({});
  const [voucherLoading,     setVoucherLoading]     = useState(false); // gerando o PDF do voucher
  const [showVoucherChoice,  setShowVoucherChoice]  = useState(false);
  const [showVoucherScope,   setShowVoucherScope]   = useState(false); // escolha: voucher individual ou do grupo
  const [acoesOpen,          setAcoesOpen]          = useState(false);
  const [showAdjPreco,       setShowAdjPreco]       = useState(false);
  const [adjCalc,            setAdjCalc]            = useState(null);   // { valor_total, detalhes }
  const [infoCalc,           setInfoCalc]           = useState(null);   // diárias calculadas (aba Informações)

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPago  = pagamentos.filter((p) => !p.cancelado && !isPagamentoPendente(p.formaPagamento)).reduce((s, p) => s + (p.valor ?? 0), 0);
  const pendente   = reserva.valorTotal - totalPago;
  const dias       = diffDays(reserva.dataInicio, reserva.dataFim);
  const cat        = categorias.find((c) => c.quartos.includes(reserva.quarto));
  const allRoomIds = categorias.flatMap((c) => c.quartos);

  // ── Voucher download ───────────────────────────────────────────────────────
  const handleDownloadVoucher = async (incluirConsumos = false) => {
    if (voucherLoading) return;
    setVoucherLoading(true);
    try {
      await buildVoucher(incluirConsumos);
      onNotify?.(tr('Voucher gerado!'));
    } catch (e) {
      onNotify?.(e?.message ?? tr('Erro ao gerar voucher.'), 'error');
    } finally {
      setVoucherLoading(false);
    }
  };

  const buildVoucher = async (incluirConsumos) => {
    const _u = userStorage.get();
    const displayPeriodos = [{
      checkin: reserva.dataInicio,
      checkout: reserva.dataFim,
      rooms: [String(reserva.quarto)],
      roomHospedes: { [String(reserva.quarto)]: pessoas },
    }];
    // Busca as diárias reais para incluir as meias diárias no ticket (linha própria, valor pela
    // metade) — como uma diária extra cobrada por meia.
    let detalhesTicket = (effectiveDetalhes ?? []).map((d) => ({ ...d }));
    let sazTicket = [
      ...new Map(
        (effectiveDetalhes ?? [])
          .map((d) => d.sazonalidade)
          .filter(Boolean)
          .map((s) => [s.descricao, s]),
      ).values(),
    ];
    try {
      const h = await hospedagemApi.buscarPorId(reserva.id);
      if (h?.diarias?.length) {
        detalhesTicket = h.diarias.map((d, i) => {
          const ci = (d.checkin || '').split(' ')[0];
          const co = (d.checkout || '').split(' ')[0];
          const meia = !!d.meia_diaria;
          return {
            descricao: meia
              ? tr('Diária {{n}} (meia diária) · {{ci}}', { n: d.numero ?? i + 1, ci })
              : tr('Diária {{n}} · {{ci}} → {{co}}', { n: d.numero ?? i + 1, ci, co }),
            valor_final: d.valor ?? 0,
          };
        });
      }
    } catch { /* mantém os detalhes do card */ }
    const precosCalc = {
      [`${reserva.quarto}_0`]: {
        valor_total: reserva.valorTotal ?? 0,
        detalhes: detalhesTicket,
        sazonalidades_aplicadas: sazTicket,
      },
    };
    const solicitanteData = { nome: reserva.titularNome ?? '', cpf: pessoas[0]?.cpf ?? '' };
    const pagsAtivos = pagamentos.filter((p) => !p.cancelado);
    gerarVoucherReserva({
      tipo: 'individual',
      periodoMode: 'unico',
      displayPeriodos,
      precosCalc,
      quartosObs: {},
      roomDescMap,
      userName: _u?.pessoa?.nome ?? _u?.nome ?? '',
      solicitante: solicitanteData,
      pagamentos: pagsAtivos,
      titulo: reserva.status === 'hospedado' ? tr('Voucher de Hospedagem') : tr('Voucher de Reserva'),
      consumos: incluirConsumos ? (reserva.consumos ?? []) : [],
    });
  };

  // Se houver consumos cobráveis, pergunta se devem entrar no voucher; senão gera direto.
  const temConsumos = (reserva.consumos ?? []).some((c) => !c.despesaPessoal);
  const requestVoucher = (origem) => {
    const anchor = alvoDe(origem);
    if (temConsumos) { if (anchor) setBalao({ tipo: 'voucherConsumo', anchor }); else setShowVoucherChoice(true); }
    else handleDownloadVoucher(false);
  };
  // Em grupo, pergunta antes se o voucher é só desta reserva ou do grupo inteiro.
  const emGrupo = !!(groupInfo && onVoucherGrupo);
  const handleVoucherClick = (origem) => {
    const anchor = alvoDe(origem);
    if (emGrupo) { if (anchor) setBalao({ tipo: 'voucherEscopo', anchor }); else setShowVoucherScope(true); }
    else requestVoucher(anchor);
  };

  // ── Gerenciar Preços (ajuste manual) ───────────────────────────────────────
  // Calcula as diárias atuais (base, sem ajuste) e abre o mesmo modal usado na
  // criação. Ao aplicar, persiste o novo valor_total na reserva.
  const openGerenciarPreco = async () => {
    setShowAdjPreco(true);
    setAdjCalc(null);
    try {
      const res = await reservaApi.calcularPreco([{
        fk_quarto:    parseInt(reserva.quarto),
        data_entrada: toBrDate(reserva.dataInicio),
        data_saida:   toBrDate(reserva.dataFim),
        ...buildGuestCalcParams(pessoas),
      }]);
      setAdjCalc(Array.isArray(res) ? res[0] : res);
    } catch (e) {
      onNotify?.(e?.message ?? tr('Erro ao calcular preço.'), 'error');
      setShowAdjPreco(false);
    }
  };

  // Fallback das diárias do card. A reserva já traz as diárias gravadas (valor e
  // sazonalidade de cada noite), então o normal é não bater no /calcular-preco: ele
  // devolveria o preço de hoje, não o que foi cobrado. Só entra em cena quando a
  // hospedagem não tem diárias (registro antigo) — aí é a única fonte de detalhes.
  // No modo pernoite elas vêm prontas em overnight.diariasDetalhes.
  // Durante a edição quem calcula é o editCalc.
  useEffect(() => {
    if (editing) return;
    if (isOvernight) { setInfoCalc(null); return; }
    if ((reserva.diarias?.length ?? 0) > 0) { setInfoCalc(null); return; }
    if (reserva.quarto == null || !reserva.dataInicio || !reserva.dataFim) { setInfoCalc(null); return; }
    let cancelled = false;
    reservaApi.calcularPreco([{
      fk_quarto:    parseInt(reserva.quarto),
      data_entrada: toBrDate(reserva.dataInicio),
      data_saida:   toBrDate(reserva.dataFim),
      ...buildGuestCalcParams(pessoas),
    }]).then((res) => { if (!cancelled) setInfoCalc(Array.isArray(res) ? res[0] : res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [editing, reserva.id, reserva.quarto, reserva.dataInicio, reserva.dataFim, reserva.diarias?.length, pessoas.length]); // eslint-disable-line

  // Em modo pernoite os dados vêm via props e mudam após cada ação na Recepção.
  // Re-sincroniza as listas internas sem remontar o modal (preserva aba e rolagem).
  useEffect(() => {
    if (!isOvernight) return;
    setPessoas(reserva.hospedes ?? []);
    setPagamentos(reserva.pagamentos ?? []);
  }, [isOvernight, reserva.id, (reserva.hospedes ?? []).length, (reserva.pagamentos ?? []).length, reserva.valorTotal]); // eslint-disable-line

  // ── Phone display mask ─────────────────────────────────────────────────────
  const fmtPhone = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  };

  // ── Pessoa search ──────────────────────────────────────────────────────────
  const handlePessoaQuery = (val) => {
    setPessoaQuery(val);
    clearTimeout(pessoaTimerRef.current);
    if (val.trim().length < 2) { setPessoaResults([]); return; }
    pessoaTimerRef.current = setTimeout(() => {
      setPessoaSearching(true);
      cadastroApi.listarPessoas({ termo: val.trim(), size: 8 })
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.content ?? []);
          setPessoaResults(list.map((p) => {
            const r = p.pessoa ?? p;
            return {
              ...r,
              bloqueado: r.status === 'BLOQUEADO',
              acompanhantes: (r.acompanhantes ?? []).map((a) => ({
                id: a.id, nome: a.nome, cpf: a.cpf ?? '',
                bloqueado: a.status === 'BLOQUEADO',
                idade: a.idade ?? null,
                data_nascimento: a.data_nascimento ?? '',
              })),
            };
          }));
        })
        .catch(() => {})
        .finally(() => setPessoaSearching(false));
    }, 300);
  };

  // Local-only — queued for save
  const handleAddPessoa = (p) => {
    if (pessoas.find((h) => h.id === p.id)) return;
    setPessoas((prev) => [...prev, {
      id: p.id, nome: p.nome, cpf: p.cpf ?? '',
      telefone: p.celular ?? p.telefone ?? '', email: p.email ?? '',
      // Aniversário real do hóspede — usado no /calcular-preco (preview). Sem isto o
      // buildGuestCalcParams enviava uma data mock (adulto de 18 anos).
      dataNascimento: p.data_nascimento ?? p.dataNascimento ?? '',
    }]);
    addOp({ type: 'addPessoa', pessoaId: p.id });
  };

  const handlePessoaResultClick = (p) => {
    if (p.bloqueado) return;
    if (p.acompanhantes?.length > 0) {
      setPendingPessoa({ titular: p, selected: new Set() });
    } else {
      handleAddPessoa(p);
      setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]);
    }
  };

  const togglePendingAcomp = (id) => setPendingPessoa((prev) => {
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });

  const confirmAddPessoas = (withCompanions) => {
    const toAdd = [pendingPessoa.titular];
    if (withCompanions) {
      pendingPessoa.titular.acompanhantes
        .filter((a) => !a.bloqueado && pendingPessoa.selected.has(a.id))
        .forEach((a) => toAdd.push(a));
    }
    toAdd.forEach((p) => handleAddPessoa(p));
    setPendingPessoa(null); setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]);
  };

  // ── Caixa flutuante de resultados ────────────────────────────────────────
  // Mesma mecânica do picker do assistente: portal em position:fixed ancorado no
  // campo, para a lista não ficar presa ao scroll da aba. Aqui abre para baixo.
  const showPessoaDrop = pendingPessoa !== null || pessoaResults.length > 0;

  useEffect(() => {
    if (!showPessoaDrop) return;
    const maxH = pendingPessoa ? 320 : 260;
    const place = () => {
      const el = pessoaWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPessoaDropStyle({
        position: 'fixed', zIndex: 99999,
        left: rect.left, top: rect.bottom + 4, width: rect.width,
        maxHeight: Math.min(maxH, window.innerHeight - rect.bottom - 12),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showPessoaDrop, pendingPessoa, pessoaResults.length]);

  useEffect(() => {
    if (!showPessoaDrop) return;
    const handlePointerDown = (e) => {
      if (pessoaWrapRef.current?.contains(e.target)) return;
      if (pessoaDropRef.current?.contains(e.target)) return;
      setPessoaResults([]); setPendingPessoa(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showPessoaDrop]);

  // Torna outra pessoa o titular: reordena (titular sempre no topo) e enfileira a operação.
  const handleSetTitular = (pessoaId) => {
    setPessoas((prev) => {
      const target = prev.find((h) => h.id === pessoaId);
      if (!target) return prev;
      const rest = prev.filter((h) => h.id !== pessoaId).map((h) => ({ ...h, titular: false }));
      return [{ ...target, titular: true }, ...rest];
    });
    setPendingOps((prev) => [
      ...prev.filter((o) => o.type !== 'setTitular'),
      { type: 'setTitular', pessoaId },
    ]);
    setHasChanges(true);
  };

  const handleRemovePessoa = (pessoaId) => {
    setPessoas((prev) => prev.filter((h) => h.id !== pessoaId));
    // If pessoa was added in this session (pending), just cancel that op
    setPendingOps((prev) => {
      const hadAdd = prev.some((o) => o.type === 'addPessoa' && o.pessoaId === pessoaId);
      if (hadAdd) return prev.filter((o) => !(o.type === 'addPessoa' && o.pessoaId === pessoaId));
      return [...prev, { type: 'removePessoa', pessoaId }];
    });
    setHasChanges(true);
  };

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  // Local-only — queued for save
  const handleAddPagamento = (payment) => {
    const tp = tiposPagamento.find((t) => t.id === payment.tipo_pagamento?.id);
    const localId = `local-${Date.now()}`;
    const novo = {
      id:             localId,
      formaPagamento: tp?.descricao ?? '',
      nomePagador:    payment.nome_pagador ?? '',
      descricao:      payment.descricao ?? '',
      valor:          payment.valor ?? 0,
      cancelado:      false,
      // Mesmo formato de data_hora_registro do backend, para a linha já mostrar
      // data e hora antes de salvar. O GET depois substitui pelo valor real.
      dataRegistro:   new Date().toLocaleString('pt-BR'),
    };
    setPagamentos((prev) => [...prev, novo]);
    addOp({ type: 'addPagamento', localId, payment });
    // Volta direto para a lista; o pagamento só entra ao clicar em Salvar alterações.
    setShowPayModal(false);
  };
  const fecharPag = () => { setShowPayModal(false); setPagRegistrado(null); };

  const handleConfirmCancelPagamento = () => {
    if (!cancelMotivo.trim()) return;
    // Mark cancelled locally
    setPagamentos((prev) => prev.map((p) =>
      p.id === cancelPagId
        ? { ...p, cancelado: true, motivoCancelamento: cancelMotivo.trim() }
        : p
    ));
    // If this is a locally-added payment (not yet saved), just remove both ops
    setPendingOps((prev) => {
      const hadAdd = prev.some((o) => o.type === 'addPagamento' && o.localId === cancelPagId);
      if (hadAdd) return prev.filter((o) => !(o.type === 'addPagamento' && o.localId === cancelPagId));
      return [...prev, { type: 'cancelPagamento', pagId: cancelPagId, motivo: cancelMotivo.trim() }];
    });
    setHasChanges(true);
    setCancelPagId(null);
    setCancelMotivo('');
  };

  // Descartar alterações: além de limpar a fila, as listas locais voltam ao que
  // veio da reserva — senão um pagamento não salvo continua aparecendo na view.
  const discardPendingOps = () => {
    setPendingOps([]);
    setHasChanges(false);
    setPessoas(reserva.hospedes ?? []);
    setPagamentos(reserva.pagamentos ?? []);
  };

  // ── Save all pending ops ────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    setSaving(true);
    const hasPessoaOps = pendingOps.some((o) => o.type === 'addPessoa' || o.type === 'removePessoa' || o.type === 'setTitular');
    const hasPagOps    = pendingOps.some((o) => o.type === 'addPagamento' || o.type === 'cancelPagamento');
    try {
      // Batch pessoa additions and removals into single calls each
      const addIds    = pendingOps.filter((o) => o.type === 'addPessoa').map((o) => o.pessoaId);
      const removeIds = pendingOps.filter((o) => o.type === 'removePessoa').map((o) => o.pessoaId);
      if (addIds.length)    await hospedagemApi.adicionarPessoas(reserva.id, addIds);
      if (removeIds.length) await hospedagemApi.removerPessoas(reserva.id, removeIds);
      // Troca de titular (após add/remove, para a pessoa já existir). Mantém só a última escolha.
      const titularOp = [...pendingOps].reverse().find((o) => o.type === 'setTitular');
      if (titularOp) await hospedagemApi.definirTitular(reserva.id, titularOp.pessoaId);

      // Payment ops (one at a time)
      const statusBackend = reserva.status === 'hospedado' ? 'PERNOITE_ATIVO' : 'RESERVA_ATIVA';
      for (const op of pendingOps) {
        if (op.type === 'addPagamento')
          await hospedagemApi.adicionarPagamentos(
            reserva.id,
            { pagamentos: [op.payment] },
            { quartoId: reserva.quarto, status: statusBackend },
          );
        else if (op.type === 'cancelPagamento')
          await reservaApi.cancelarPagamento(op.pagId, op.motivo);
      }

      setPendingOps([]);
      setHasChanges(false);

      if (hasPessoaOps || hasPagOps) {
        // Os endpoints de pessoas recalculam diárias/valor_total no backend (e removem o
        // desconto vigente); os de pagamento devolvem id real, data/hora e funcionário.
        // Nos dois casos re-buscamos a reserva para a view refletir o que foi gravado.
        try {
          const upd = await hospedagemApi.buscarPorId(reserva.id);
          const normalized = normalizeReserva(upd);
          onSync?.(normalized);
          setPessoas(normalized.hospedes ?? []);
          setPagamentos(normalized.pagamentos ?? []);
        } catch {
          // Sem o GET, ao menos o pai fica com o que temos localmente.
          onSync?.({ ...reserva, pagamentos });
        }
      }
      onNotify?.(tr('Alterações salvas!'));
      if (inline) { setEditing(false); setEditActiveTab('dados'); }
    } catch (e) {
      onNotify?.(e?.message ?? tr('Erro ao salvar alterações.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit calc ─────────────────────────────────────────────────────────────
  const [editCalc,        setEditCalc]        = useState(null);
  const [editCalcLoading, setEditCalcLoading] = useState(false);
  const [origCalc,        setOrigCalc]        = useState(null);

  // ── Room availability for the edit dates ─────────────────────────────────────
  const [editAvailability, setEditAvailability] = useState(null); // Set<roomId> | null
  const [editAvailLoading, setEditAvailLoading] = useState(false);

  // Re-check availability via /disponibilidade/quartos whenever the edit dates change
  useEffect(() => {
    if (!editing || !editCheckin || !editCheckout) { setEditAvailability(null); setEditAvailLoading(false); return; }
    let cancelled = false;
    setEditAvailLoading(true);
    setEditAvailability(null);
    const brDate = (d) => toBrDate(formatDate(d));
    reservaApi.verificarDisponibilidade({
      data_entrada: brDate(editCheckin),
      data_saida:   brDate(editCheckout),
    }).then((results) => {
      if (cancelled) return;
      const avail = new Set(
        (Array.isArray(results) ? results : [])
          .filter((r) => r.disponivel)
          .map((r) => r.quarto_id ?? r.fk_quarto)
      );
      // This reservation occupies its own room for these dates, so the API reports it as
      // unavailable — keep it selectable so the user isn't blocked from their current room.
      avail.add(reserva.quarto);
      setEditAvailability(avail);
    }).catch(() => { if (!cancelled) setEditAvailability(null); })
      .finally(() => { if (!cancelled) setEditAvailLoading(false); });
    return () => { cancelled = true; };
  }, [editing, editCheckin, editCheckout]); // eslint-disable-line

  const editAvailableRooms = useMemo(() => {
    if (!editAvailability) return allRoomIds;
    return allRoomIds.filter((r) => editAvailability.has(r));
  }, [editAvailability, allRoomIds]);

  // ── Occupied nights for the selected room (real-time, from in-memory calendar) ──
  // Builds a Set<'yyyy-MM-dd'> of nights already taken by OTHER reservations in the
  // currently-selected room, so the inline calendar can block them as the user picks dates.
  // Só reservas confirmadas/ativas ocupam de fato o quarto — alinhado ao backend
  // (verificarDisponibilidadeLote bloqueia RESERVA_ATIVA/PERNOITE_ATIVO/DAY_USE_ATIVO, mas NÃO
  // RESERVA_SOLICITADA). Solicitações pendentes, ausentes, cancelados e finalizados não bloqueiam.
  const BLOCKING_STATUSES = useMemo(() => new Set(['confirmada', 'hospedado']), []);

  // The parent only keeps the current+next month in memory, so navigating the inline
  // calendar to other months would show no occupied nights. Lazily fetch reservations for
  // any month the user navigates to and accumulate them here.
  const [extraReservas, setExtraReservas] = useState([]);
  const fetchedMonthsRef = useRef(new Set());
  const handleEditMonthChange = useCallback((year, month0) => {
    const key = `${year}-${month0}`;
    if (fetchedMonthsRef.current.has(key)) return;
    fetchedMonthsRef.current.add(key);
    hospedagemApi.buscar({
      status: ['RESERVA_ATIVA', 'PERNOITE_ATIVO', 'PERNOITE_FINALIZADO'],
      mes: month0 + 1,
      ano: year,
    }).then((data) => {
      // /hospedagem/buscar returns a FLAT array of reservations (same as loadReservas).
      const items = Array.isArray(data) ? data : [];
      const seen = new Set();
      const norm = [];
      for (const r of items) {
        if (!seen.has(r.id)) { seen.add(r.id); norm.push(normalizeReserva(r)); }
      }
      const valid = norm.filter((r) => r.dataInicio);
      setExtraReservas((prev) => {
        const known = new Set(prev.map((r) => r.id));
        return [...prev, ...valid.filter((r) => !known.has(r.id))];
      });
    }).catch(() => { fetchedMonthsRef.current.delete(key); }); // allow retry on failure
  }, []);

  // Occupancy with midday semantics: a stay runs from MIDDAY of check-in to MIDDAY of
  // check-out. So per calendar day we track which half is taken:
  //   • check-in day      → afternoon busy  (pm / right half)
  //   • full middle nights → whole day busy (am + pm)
  //   • check-out day     → morning busy    (am / left half)
  // This lets back-to-back reservations share a day (one leaves in the morning, the next
  // arrives in the afternoon). Map<'yyyy-MM-dd', { am: boolean, pm: boolean }>.
  const occupancy = useMemo(() => {
    const room = editQuarto[0];
    const map = new Map();
    if (!room) return map;
    const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const mark = (d, half) => {
      const k = dkey(d);
      const cur = map.get(k) || { am: false, pm: false };
      cur[half] = true;
      map.set(k, cur);
    };
    const seen = new Set();
    const all = [...reservas, ...extraReservas].filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
    for (const res of all) {
      if (String(res.quarto) !== String(room)) continue;
      if (res.id === reserva.id) continue;             // ignore the reservation being edited
      if (!BLOCKING_STATUSES.has(res.status)) continue; // ignora solicitações/ausentes/etc.
      if (!res.dataInicio || !res.dataFim) continue;
      const start = new Date(res.dataInicio + 'T00:00:00');
      const end   = new Date(res.dataFim    + 'T00:00:00');
      if (!(start < end)) continue;
      mark(start, 'pm');                               // check-in: afternoon busy
      const cur = new Date(start); cur.setDate(cur.getDate() + 1);
      while (cur < end) { mark(cur, 'am'); mark(cur, 'pm'); cur.setDate(cur.getDate() + 1); } // full nights
      mark(end, 'am');                                 // check-out: morning busy
    }
    return map;
  }, [reservas, extraReservas, editQuarto, reserva.id, BLOCKING_STATUSES]);

  // ── Limites de período pela ocupação do quarto ────────────────────────────
  // A estadia vai do meio-dia do check-in ao meio-dia do check-out, então uma
  // noite só é livre se a tarde do dia e a manhã do dia seguinte estiverem livres.
  // Mesma regra que o DatePicker aplica no modo range (maxEndForStart).
  const maxCheckoutFor = useCallback((start) => {
    if (!start || occupancy.size === 0) return null;
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    for (let i = 0; i < 400; i++) {
      cur.setDate(cur.getDate() + 1);
      const o = occupancy.get(formatDate(cur));
      if (!o || (!o.am && !o.pm)) continue;
      // Obstáculo é outra entrada (só a tarde ocupada): ainda dá para sair de manhã.
      if (o.pm && !o.am) return new Date(cur);
      const prev = new Date(cur); prev.setDate(prev.getDate() - 1);
      return prev;
    }
    return null;
  }, [occupancy]);

  const maxCheckout = useMemo(() => maxCheckoutFor(editCheckin), [maxCheckoutFor, editCheckin]);

  const mudaCheckin = (d) => {
    setEditCheckin(d);
    const max = maxCheckoutFor(d);
    if (editCheckout && d && (editCheckout <= d || (max && editCheckout > max))) {
      setEditCheckout(null);
    }
  };

  // Dias cuja tarde já está ocupada não podem receber um check-in.
  const checkinBloqueados = useMemo(() => {
    const set = new Set();
    occupancy.forEach((o, k) => { if (o.pm) set.add(k); });
    return set;
  }, [occupancy]);

  // Preço original ("antes"). Sem arraste, o primeiro /calcular-preco do modo de
  // edição já roda com o quarto, as datas e as pessoas da reserva — é o próprio
  // "antes" — e é reaproveitado no efeito abaixo, evitando uma segunda chamada.
  useEffect(() => {
    if (!editing || !dragValues) return;
    let cancelled = false;
    setOrigCalc(null);
    reservaApi.calcularPreco([{
      fk_quarto:    parseInt(reserva.quarto),
      data_entrada: toBrDate(reserva.dataInicio),
      data_saida:   toBrDate(reserva.dataFim),
      ...buildGuestCalcParams(pessoas),
    }]).then((res) => { if (!cancelled) setOrigCalc(Array.isArray(res) ? res[0] : res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [editing]);

  // Meia diária (saída tardia) na edição: começa como está gravada na reserva.
  const horaMeiaOrig = reserva.meiaDiaria ? (reserva.saidaPrevista?.split(' ')[1]?.slice(0, 5) ?? '') : '';
  const [editMeia,     setEditMeia]     = useState(!!reserva.meiaDiaria);
  const [editHoraMeia, setEditHoraMeia] = useState(horaMeiaOrig);
  const editCatCheckout = categorias.find((c) => (c.quartos || []).map(String).includes(String(editQuarto[0])))?.checkout || '12:00';
  // A tarde do dia do check-out precisa estar livre para o hóspede ficar até mais tarde.
  const meiaBloqueada = !!editCheckout && !!occupancy.get(formatDate(editCheckout))?.pm;
  const temMeiaEdit   = editMeia && !!editHoraMeia && editHoraMeia > editCatCheckout && !meiaBloqueada;
  const meiaMudou     = temMeiaEdit !== !!reserva.meiaDiaria || (temMeiaEdit && editHoraMeia !== horaMeiaOrig);

  useEffect(() => {
    if (!editing || !editQuarto[0] || !editCheckin || !editCheckout) return;
    let cancelled = false;
    setEditCalcLoading(true);
    setEditCalc(null);
    const brDate = (d) => toBrDate(formatDate(d));
    const itens = [{
      fk_quarto:    parseInt(editQuarto[0]),
      data_entrada: brDate(editCheckin),
      data_saida:   brDate(editCheckout),
      ...buildGuestCalcParams(pessoas),
    }];
    // Mesma regra da criação: a meia diária é metade da noite do dia do check-out.
    if (temMeiaEdit) {
      const dia = new Date(editCheckout); dia.setDate(dia.getDate() + 1);
      itens.push({ ...itens[0], data_entrada: brDate(editCheckout), data_saida: brDate(dia) });
    }
    reservaApi.calcularPreco(itens).then((res) => {
      if (cancelled) return;
      const lista = Array.isArray(res) ? res : [res];
      const calc  = lista[0];
      const meia  = temMeiaEdit ? lista[1] : null;
      const meiaValor = meia ? Math.round(((meia.valor_total ?? 0) / 2) * 100) / 100 : 0;
      if (!calc || meiaValor <= 0) { setEditCalc(calc); return; }
      const noite = meia.detalhes?.[0] ?? {};
      setEditCalc({
        ...calc,
        valor_total: (calc.valor_total ?? 0) + meiaValor,
        detalhes: [...(calc.detalhes ?? []), {
          ...noite,
          valor_final: meiaValor,
          valor_criancas: noite.valor_criancas != null ? noite.valor_criancas / 2 : null,
          meia_diaria: true,
        }],
      });
    })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEditCalcLoading(false); });
    return () => { cancelled = true; };
  }, [editing, editQuarto[0], editCheckin, editCheckout, pessoas, temMeiaEdit, editHoraMeia]); // eslint-disable-line

  // ── Edit save (quarto/datas/obs) ──────────────────────────────────────────
  const [editSaving,    setEditSaving]    = useState(false);
  const [editActiveTab, setEditActiveTab] = useState('dados');
  // Observação sai da edição: muda direto da view, pelo botão "Alterar observação".
  const [obsAberta, setObsAberta] = useState(false);
  const [obsTexto,  setObsTexto]  = useState('');
  const [obsSaving, setObsSaving] = useState(false);

  const handleSaveObs = async () => {
    setObsSaving(true);
    try {
      const cat = categorias.find((c) => (c.quartos || []).map(String).includes(String(reserva.quarto)));
      await onUpdate(reserva.id, {
        quarto_id:          parseInt(reserva.quarto),
        status:             'RESERVA_ATIVA',
        data_hora_checkin:  `${toBrDate(reserva.dataInicio)} ${cat?.checkin || '14:00'}`,
        data_hora_checkout: `${toBrDate(reserva.dataFim)} ${cat?.checkout || '12:00'}`,
        observacao:         obsTexto.trim(),
        hora_saida_meia_diaria: reserva.meiaDiaria ? horaMeiaOrig : null,
        ...(reserva.valorTotal != null ? { valor_total: reserva.valorTotal } : {}),
      });
      setObsAberta(false);
    } finally {
      setObsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const valorTotal = editCalc?.valor_total ?? reserva.valorTotal;
      const editCat = categorias.find((c) => (c.quartos || []).map(String).includes(String(editQuarto[0])));
      const eci = editCat?.checkin || '14:00';
      const eco = editCat?.checkout || '12:00';
      await onUpdate(reserva.id, {
        quarto_id:          parseInt(editQuarto[0]),
        status:             'RESERVA_ATIVA',
        data_hora_checkin:  `${toBrDate(formatDate(editCheckin))} ${eci}`,
        data_hora_checkout: `${toBrDate(formatDate(editCheckout))} ${eco}`,
        observacao:         (reserva.observacao ?? '').trim(),
        hora_saida_meia_diaria: temMeiaEdit ? editHoraMeia : null,
        ...(valorTotal != null ? { valor_total: valorTotal } : {}),
      });
      setEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const canSave = editQuarto.length > 0 && editCheckin && editCheckout && editCheckout > editCheckin;

  const hasChangedDatesOrRoom =
    editQuarto[0] !== String(reserva.quarto) ||
    (editCheckin  ? formatDate(editCheckin)  : '') !== reserva.dataInicio ||
    (editCheckout ? formatDate(editCheckout) : '') !== reserva.dataFim;

  const hasChangedData = hasChangedDatesOrRoom || meiaMudou;

  // Sem arraste: o primeiro cálculo da edição vira o "antes", desde que quarto,
  // datas e pessoas ainda sejam os da reserva.
  useEffect(() => {
    if (!editing || dragValues || origCalc || !editCalc) return;
    if (hasChangedDatesOrRoom || meiaMudou || hasChanges) return;
    setOrigCalc(editCalc);
  }, [editing, editCalc, origCalc, hasChangedDatesOrRoom, hasChanges]); // eslint-disable-line

  const goBackFromEdit = (e) => {
    if (hasChanges) {
      const anchor = alvoDe(e);
      if (anchor) setBalao({ tipo: 'descartar', anchor }); else setShowDiscard(true);
      return;
    }
    setEditing(false); setEditActiveTab('dados');
  };

  // Hóspedes no desenho da view: titular com contatos e acompanhantes em tabela (CPF e idade).
  // acoesAcomp(h) põe ações embaixo de cada acompanhante, à direita (Gerenciar pessoas).
  const renderHospedes = (lista, acoesAcomp = null) => {
    // Contato só do titular; acompanhantes mostram CPF e idade.
    const hoje      = new Date();
    const [tit, ...acomps] = lista;
    const idadeTxt  = (h) => { const i = idadeEm(h.dataNascimento, hoje); return i == null ? null : tr('{{idade}} anos', { idade: i }); };
    const telDigits = String(tit.telefone ?? '').replace(/\D/g, '');
    const waNumber  = telDigits ? (telDigits.length <= 11 ? `55${telDigits}` : telDigits) : '';
    const titMeta   = [tit.cpf && fmtCpf(tit.cpf), idadeTxt(tit)].filter(Boolean).join(' · ');
    return (
      <>
        <div className={styles.rvTitular}>
          <div className={styles.rvTitularInfo}>
            <div className={styles.rvTitularNome}>
              {tit.nome}
              <span className={styles.rcChip}>{tr('Titular')}</span>
            </div>
            {titMeta && <div className={styles.rvTitularMeta}>{titMeta}</div>}
          </div>
          {(tit.telefone || tit.email) && (
            <div className={styles.rvTitularContatos}>
              {tit.telefone && (waNumber ? (
                <a className={styles.rvContato}
                  href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
                  title={tr('WhatsApp {{v0}}', { v0: fmtPhone(tit.telefone) })} onClick={(e) => e.stopPropagation()}>
                  <img src={whatsappIcon} alt={tr('WhatsApp')} className={styles.rvContactIcon}
                    loading="eager" decoding="sync" draggable={false} />
                  <span>{fmtPhone(tit.telefone)}</span>
                </a>
              ) : (
                <div className={styles.rvContato}><span>{fmtPhone(tit.telefone)}</span></div>
              ))}
              {tit.email && (
                <a className={styles.rvContato}
                  href={`mailto:${tit.email}`} title={tr('E-mail: {{email}}', { email: tit.email })} onClick={(e) => e.stopPropagation()}>
                  <img src={emailIcon} alt={tr('E-mail')} className={styles.rvContactIcon}
                    loading="eager" decoding="sync" draggable={false} />
                  <span>{tit.email}</span>
                </a>
              )}
            </div>
          )}
        </div>
        {acomps.length > 0 && (
          <div className={styles.dtScroll}>
            <table className={styles.dtTable}>
              <thead><tr>
                <th>{tr('Acompanhantes')}</th><th>{tr('CPF')}</th><th className={styles.dtDir}>{tr('Idade')}</th>
              </tr></thead>
              <tbody>
                {acomps.map((h) => (
                  <Fragment key={h.id ?? h.nome}>
                    <tr className={acoesAcomp ? styles.dtComAcoes : undefined}>
                      <td className={[styles.dtQuebra, styles.dtPagador].join(' ')}><span className={styles.dtCelTit}>{h.nome}</span></td>
                      <td>{h.cpf ? fmtCpf(h.cpf) : '—'}</td>
                      <td className={styles.dtDir}>{idadeTxt(h) ?? '—'}</td>
                    </tr>
                    {acoesAcomp && (
                      <tr className={styles.dtAcoesLinha}><td colSpan={3}>{acoesAcomp(h)}</td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderBalao = () => {
    if (!balao?.anchor) return null;
    const b = balao;
    const msg = (c) => <p className={styles.balaoMsg}>{c}</p>;
    let corpo = null;
    if (b.tipo === 'hospedar') corpo = <>
      {msg(<>{tr('Mover a reserva de')} <b>{reserva.titularNome}</b> {tr('para')} <b>{tr('Hospedado')}</b>{tr('? Ela não poderá mais ser editada por aqui.')}</>)}
      <BalaoAcoes onCancelar={fecharBalao} confirmar={tr('Hospedar')}
        onConfirmar={() => { fecharBalao(); onMoverPernoite?.(reserva.id); onClose(); }} />
    </>;
    else if (b.tipo === 'ausente') corpo = <>
      {msg(<>{tr('Marcar a reserva de')} <b>{reserva.titularNome}</b> {tr('como')} <b>{tr('ausente')}</b>?</>)}
      <BalaoAcoes onCancelar={fecharBalao} confirmar={saving ? <Loader2 size={13} className={styles.spin} /> : tr('Confirmar')} perigo disabled={saving}
        onConfirmar={async () => { setSaving(true); try { await onAusente?.(reserva.id); fecharBalao(); onClose(); } finally { setSaving(false); } }} />
    </>;
    else if (b.tipo === 'cancelar') corpo = <>
      {msg(<>{reserva.status === 'orcamento' ? tr('Cancelar o orçamento de') : tr('Cancelar a reserva de')} <b>{reserva.titularNome}</b>? {tr('Esta ação não pode ser desfeita.')}</>)}
      <textarea className={[styles.motivoTextarea, styles.balaoCampo].join(' ')} rows={2} autoFocus
        placeholder={tr('Motivo do cancelamento')} value={cancelMotivRes} onChange={(e) => setCancelMotivRes(e.target.value)} />
      <BalaoAcoes onCancelar={fecharBalao} cancelarTxt={tr('Voltar')} confirmar={tr('Cancelar')} perigo disabled={!cancelMotivRes.trim()}
        onConfirmar={() => {
          fecharBalao();
          // Para orçamentos, passa o ID do orçamento (não da hospedagem) para o endpoint correto
          const orcId = reserva.status === 'orcamento' ? (reserva.orcamentoInfo?.id ?? null) : null;
          onCancel(reserva.id, cancelMotivRes.trim(), orcId);
          onClose();
        }} />
    </>;
    else if (b.tipo === 'cancelarPag') corpo = <>
      {msg(<>{tr('Cancelar este pagamento? Informe o motivo.')}</>)}
      <textarea className={[styles.motivoTextarea, styles.balaoCampo].join(' ')} rows={2} autoFocus
        placeholder={tr('Motivo do cancelamento')} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
      <BalaoAcoes onCancelar={() => { fecharBalao(); setCancelPagId(null); }} cancelarTxt={tr('Voltar')} confirmar={tr('Confirmar')} perigo
        disabled={!cancelMotivo.trim()} onConfirmar={() => { fecharBalao(); handleConfirmCancelPagamento(); onNotify?.(tr('Pagamento cancelado. Salve para aplicar.')); }} />
    </>;
    else if (b.tipo === 'descartar' || b.tipo === 'descartarFechar') corpo = <>
      {msg(tr('Descartar as alterações não salvas?'))}
      <BalaoAcoes onCancelar={fecharBalao} cancelarTxt={tr('Continuar editando')} confirmar={tr('Descartar')} perigo
        onConfirmar={() => {
          fecharBalao(); discardPendingOps(); onNotify?.(tr('Alterações descartadas.'));
          if (b.tipo === 'descartarFechar') onClose(); else { setEditing(false); setEditActiveTab('dados'); }
        }} />
    </>;
    else if (b.tipo === 'voucherEscopo') corpo = <>
      {msg(tr('Esta reserva faz parte de um grupo. Gerar o voucher só desta reserva ou do grupo inteiro?'))}
      <BalaoAcoes onCancelar={() => { const a = b.anchor; fecharBalao(); requestVoucher(a); }} cancelarTxt={tr('Só esta')}
        confirmar={<>{tr('Grupo')}{groupInfo?.count ? tr(' ({{count}} apt{{v1}})', { count: groupInfo.count, v1: groupInfo.count !== 1 ? 's' : '' }) : ''}</>}
        onConfirmar={async () => {
          fecharBalao();
          try { await onVoucherGrupo?.(); onNotify?.(tr('Voucher do grupo gerado!')); }
          catch (e) { onNotify?.(e?.message ?? tr('Erro ao gerar voucher.'), 'error'); }
        }} />
    </>;
    else if (b.tipo === 'voucherConsumo') corpo = <>
      {msg(tr('Esta hospedagem possui consumos registrados. Incluí-los no voucher?'))}
      <BalaoAcoes onCancelar={() => { fecharBalao(); handleDownloadVoucher(false); }} cancelarTxt={tr('Sem consumos')}
        confirmar={tr('Com consumos')} onConfirmar={() => { fecharBalao(); handleDownloadVoucher(true); }} />
    </>;
    return <Balao anchor={b.anchor} onClose={fecharBalao}>{corpo}</Balao>;
  };

  // ── Edit mode render ───────────────────────────────────────────────────────
  // No painel a edição abre ao lado da view, que continua visível à esquerda.
  const renderEdicao = () => {
    // Botões de um dia a mais / a menos, nos mesmos limites dos calendários.
    const somaDia = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const podeCheckinDepois  = !!editCheckin && (!editCheckout || somaDia(editCheckin, 1) < editCheckout);
    const podeCheckoutAntes  = !!editCheckout && (!editCheckin || somaDia(editCheckout, -1) > editCheckin);
    const podeCheckoutDepois = !!editCheckout && (!maxCheckout || somaDia(editCheckout, 1) <= maxCheckout);

    // ── Valores (diárias + totais) — mesma lista da view e do passo "Resumo &
    //    Pagamento", compartilhada pelas abas Pessoas e Pagamentos.
    //    O /calcular-preco devolve o preço de tabela, então o ajuste manual salvo
    //    ("Gerenciar Preços") é reaplicado por cima.
    // Sem mudar quarto/datas, valem as diárias gravadas — as mesmas da tabela da view.
    const valGravadas    = (editActiveTab === 'pagamentos' && !hasChangedDatesOrRoom && !meiaMudou)
      ? detalhesDasDiarias(reserva.diarias, pessoas, reserva.dataInicio)
      : [];
    const valPersistidas = valGravadas.length > 0;
    const valDetalhes    = valPersistidas ? valGravadas : (editCalc?.detalhes ?? []);
    const valAdj         = reserva.novoPreco ? novoPrecoToState(reserva.novoPreco) : null;
    const valBaseDiarias = valDetalhes.map((d) => ({ valor: d.valor_final ?? 0 }));
    const valBaseTotal   = valBaseDiarias.reduce((acc, d) => acc + d.valor, 0);
    const valAdjResult   = (valAdj && !(valAdj.mode === 'diaria' && valPersistidas))
      ? computeAdjustedTotal({ baseTotal: valBaseTotal, baseDiarias: valBaseDiarias, ...valAdj })
      : null;
    const valIsDiariaAdj = valAdj?.mode === 'diaria' && !valPersistidas;
    const valDiariaValor = valIsDiariaAdj ? (valAdjResult?.diarias?.[0]?.valor ?? 0) : null;
    const valTotal       = valDetalhes.length > 0
      ? (valAdjResult ? valAdjResult.valorTotal : valBaseTotal)
      : (reserva.valorTotal ?? 0);
    const valDiff        = valTotal - valBaseTotal;
    const valPendente    = Math.max(0, valTotal - totalPago);
    const valQuitado     = valTotal > 0 && totalPago >= valTotal - 0.005;
    // Uma diária só que já vale o total: a linha da diária repete o valor e o "Total" some.
    const valUnico       = valDetalhes.length === 1
      ? (valIsDiariaAdj ? valDiariaValor : (valDetalhes[0].valor_final ?? 0))
      : null;
    const valRedundante  = valUnico !== null && Math.abs(valTotal - valUnico) < 0.005;
    // Valor de cada diária antes desta edição — origCalc é buscado uma só vez ao
    // entrar no modo de edição, então não acompanha o que está sendo alterado.
    // O casamento é pela noite (data da descrição), para seguir correto quando a
    // edição muda o período; sem descrição (pernoite), cai na posição.
    const valOrigDetalhes = valPersistidas ? [] : (origCalc?.detalhes ?? []);
    const valOrigPorNoite = new Map();
    valOrigDetalhes.forEach((d, i) => {
      valOrigPorNoite.set(periodoDiaria(d.descricao) || `#${i}`, d.valor_final ?? 0);
    });
    const valDetalhesComAnterior = valDetalhes.map((d, i) => {
      const ant = valOrigPorNoite.get(periodoDiaria(d.descricao) || `#${i}`);
      return (ant != null && Math.abs(ant - (d.valor_final ?? 0)) >= 0.005)
        ? { ...d, _valorAnterior: ant }
        : d;
    });
    const valGrupos      = groupDiarias(valDetalhesComAnterior, valIsDiariaAdj ? () => valDiariaValor : null);

    const renderValoresLista = () => {
      const showQuitado = valQuitado && !valRedundante;
      const showTotal   = !valQuitado && !valRedundante;
      const showPend    = !valQuitado && valPendente > 0.005;
      return (
        <>
          {!valPersistidas && editCalcLoading && valGrupos.length === 0 && (
            <div className={styles.rcSectionLabel}>{tr('Calculando…')}</div>
          )}
          {valGrupos.map((g, gi) => (
            <div key={g.key} className={[styles.rcDiariaRow, valQuitado ? styles.rcDiariaPago : ''].join(' ')}>
              <span>
                {g.meia ? tr('Meia diária') : g.qtd > 1 ? tr('Diárias') : tr('Diária')}
                {diariaSubs(g) && <span className={styles.rcDiariaSub}> · {diariaSubs(g)}</span>}
              </span>
              <span className={styles.rcDiariaVal}>
                {/* Selo uma vez só, na última diária, para não repetir em cada linha. */}
                {valQuitado && gi === valGrupos.length - 1 && (
                  <span className={styles.rcDiariaTag}>{tr('(pago 100%)')}</span>
                )}
                {valIsDiariaAdj
                  ? <span className={styles.rcDiariaOld}>{fmtBRL(g.valorOriginal)}</span>
                  : g.anterior !== null && <span className={styles.rcDiariaOld}>{fmtBRL(g.anterior)}</span>}
                {g.qtd > 1 && <span className={styles.rcDiariaMult}>{g.qtd}{tr('x')} </span>}
                {fmtBRL(g.valor)}
              </span>
            </div>
          ))}

          {/* Ajuste sobre o total (desconto/adicional em reais ou %) — uma linha só */}
          {valAdj && !valIsDiariaAdj && Math.abs(valDiff) >= 0.005 && (
            <div className={styles.rcDiariaRow}>
              <span className={styles.rcDiariaSub}>{describeAdjustment(valAdj)}</span>
              <span className={styles.rcDiariaVal} style={{ color: valDiff < 0 ? 'var(--emerald)' : '#f97316' }}>
                {valDiff > 0 ? '+' : ''}{fmtBRL(valDiff)}
              </span>
            </div>
          )}

          {/* Totais — o Total some quando a única diária já repete o valor */}
          {(showQuitado || showTotal || showPend) && (
            <div className={styles.rcResumoList}>
              {showQuitado && (
                <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                  <span>{tr('Total pago')}</span><span>{fmtBRL(totalPago)}</span>
                </div>
              )}
              {showTotal && (
                <div className={styles.rcResumoRow}>
                  <span>{tr('Total')}</span><span>{fmtBRL(valTotal)}</span>
                </div>
              )}
              {showPend && (
                <div className={[styles.rcResumoRow, styles.rcResumoDanger].join(' ')}>
                  <span>{tr('Pendente')}</span><span>{fmtBRL(valPendente)}</span>
                </div>
              )}
            </div>
          )}
        </>
      );
    };

    // Pessoas ou período alterados recalculam as diárias: compara com o total gravado.
    const pessoasMudaram = pendingOps.some((o) => o.type === 'addPessoa' || o.type === 'removePessoa');
    const periodoMudou   = editActiveTab === 'dados' && (hasChangedDatesOrRoom || meiaMudou);
    const totalAntes     = reserva.valorTotal ?? 0;
    const difPessoas     = valTotal - totalAntes;
    const mostraDif      = (pessoasMudaram || periodoMudou) && !editCalcLoading && valDetalhes.length > 0 && Math.abs(difPessoas) >= 0.005;

    const renderValoresResumo = ({ titulo = tr('Valores'), semDiarias = false, fechar = true } = {}) => (
      <aside className={[styles.finResumo, styles.finResumoView, styles.finResumoAcao].join(' ')}>
        <div className={[styles.finCab, styles.finCabAcao].join(' ')}>
          <h4 className={styles.finTit}>{titulo}</h4>
          {fechar && (
            <button type="button" className={styles.finCabFechar} onClick={goBackFromEdit} aria-label={tr('Fechar')}>
              <X size={16} />
            </button>
          )}
        </div>
        {!valPersistidas && editCalcLoading && valGrupos.length === 0 && (
          <div className={styles.finSub}>{tr('Calculando…')}</div>
        )}
        {mostraDif && (
          <div className={[styles.finMudanca, difPessoas > 0 ? styles.finMudancaMais : styles.finMudancaMenos].join(' ')}>
            <span>{periodoMudou ? tr('O valor mudou com o novo período') : tr('As diárias mudaram com as pessoas')}</span>
            <b>{fmtBRL(totalAntes)} → {fmtBRL(valTotal)} ({difPessoas > 0 ? '+' : ''}{fmtBRL(difPessoas)})</b>
          </div>
        )}
        {!semDiarias && valGrupos.map((g) => {
          const hospedes = diariaSubs({ ...g, saz: null });
          const anterior = valIsDiariaAdj ? g.valorOriginal : g.anterior;
          const mudou    = !valIsDiariaAdj && anterior != null && Math.abs(anterior - g.valor) >= 0.005;
          return (
            <div key={g.key} className={[styles.finLinha, mudou ? styles.finLinhaMudou : ''].join(' ')}>
              <span className={styles.finLinhaTxt}>
                {g.qtd > 1
                  ? tr('{{qtd}} diárias × {{valor}}', { qtd: g.qtd, valor: fmtBRL(g.valor) })
                  : g.meia ? tr('Meia diária') : valGrupos.length > 1 ? tr('{{n}}ª Diária', { n: g.numeros[0] }) : tr('Diária')}
                {hospedes && <small className={styles.finSub}>{hospedes}</small>}
                {g.saz && <small className={styles.finSub}>{tr('Sazonalidade aplicada: {{saz}}', { saz: g.saz })}</small>}
                {mudou && (
                  <small className={g.valor > anterior ? styles.finDifMais : styles.finDifMenos}>
                    {tr('{{v}} por diária', { v: `${g.valor > anterior ? '+' : ''}${fmtBRL(g.valor - anterior)}` })}
                  </small>
                )}
              </span>
              <b>
                {anterior != null && <span className={styles.rcDiariaOld}>{fmtBRL(anterior * g.qtd)}</span>}
                {fmtBRL(g.valor * g.qtd)}
              </b>
            </div>
          );
        })}
        {!semDiarias && valAdj && !valIsDiariaAdj && Math.abs(valDiff) >= 0.005 && (
          <div className={styles.finLinha}><span>{describeAdjustment(valAdj)}</span><b>{valDiff > 0 ? '+' : ''}{fmtBRL(valDiff)}</b></div>
        )}
        {!semDiarias && <hr className={styles.finSep} />}
        <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Total')}</span><b>{fmtBRL(valTotal)}</b></div>
        {totalPago > 0.005 && (
          <div className={[styles.finLinha, styles.finPago].join(' ')}><span>{tr('Pago')}</span><b>{fmtBRL(totalPago)}</b></div>
        )}
        {valQuitado ? (
          <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
        ) : valPendente > 0.005 && (
          <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(valPendente)}</b></div>
        )}
      </aside>
    );

    // Gerenciar diárias: uma linha por diária; o valor anterior aparece riscado quando muda.
    const renderDiariasTabela = () => (
      <div className={[styles.rcSection, styles.gdDiarias].join(' ')}>
        <div className={styles.rcSectionHead}>
          <span className={styles.rcSectionLabel}>{tr('Diárias')}</span>
          {!valPersistidas && editCalcLoading && <Loader2 size={13} className={styles.spin} />}
        </div>
        {valDetalhesComAnterior.length === 0 ? (
          <div className={styles.pagEmpty}>{editCalcLoading ? tr('Calculando…') : tr('Sem diárias para o período.')}</div>
        ) : (
          <div className={styles.dtScroll}>
            <table className={styles.dtTable}>
              <thead><tr>
                <th>{tr('Nº')}</th><th>{tr('Período')}</th><th>{tr('Ocupação')}</th><th className={styles.dtDir}>{tr('Valor')}</th><th />
              </tr></thead>
              <tbody>
                {valDetalhesComAnterior.map((d, i, arr) => {
                  const ini    = addDaysStr(editCheckin ? formatDate(editCheckin) : reserva.dataInicio, i);
                  const orig   = d.valor_final ?? 0;
                  const valor  = valIsDiariaAdj ? valDiariaValor : orig;
                  const antes  = valIsDiariaAdj ? orig : d._valorAnterior;
                  const mudou  = antes != null && Math.abs(antes - valor) >= 0.005;
                  const per    = periodoDiaria(d.descricao);
                  // Só dá para tirar diária das pontas: a primeira adia o check-in, a última antecipa o check-out.
                  const primeira = i === 0 && arr.length > 1 && podeCheckinDepois;
                  const ultima   = i === arr.length - 1 && arr.length > 1 && podeCheckoutAntes;
                  return (
                    <tr key={i} className={mudou ? styles.dtMudou : undefined}>
                      <td><span className={styles.dtNum}>{String(i + 1).padStart(2, '0')}</span></td>
                      <td>{per ? per.replace(/(\d{2}\/\d{2})\/\d{4}/g, '$1').replace(/\s*->\s*/, ' → ') : `${fmtDiaMes(ini)} → ${fmtDiaMes(addDaysStr(ini, 1))}`}</td>
                      <td className={styles.dtQuebra}>
                        {normalizaAdultos(descricaoHospedes(d.descricao)) || '—'}
                        {d.meia_diaria && <span className={styles.dtTag}>{tr('Meia diária')}</span>}
                      </td>
                      <td className={[styles.dtDir, styles.dtValor].join(' ')}>
                        {mudou && <span className={styles.rcDiariaOld}>{fmtBRL(antes)}</span>}
                        {fmtBRL(valor)}
                      </td>
                      <td className={styles.gdAcaoCel}>
                        {(primeira || ultima) && (
                          <button type="button" className={[styles.rvSecBtn, styles.rvSecBtnPerigo].join(' ')} title={tr('Remover diária')}
                            onClick={() => (ultima ? setEditCheckout(somaDia(editCheckout, -1)) : mudaCheckin(somaDia(editCheckin, 1)))}>
                            {tr('Remover')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {valAdj && !valIsDiariaAdj && Math.abs(valDiff) >= 0.005 && (
                  <tr>
                    <td colSpan={3}>{describeAdjustment(valAdj)}</td>
                    <td className={[styles.dtDir, valDiff < 0 ? styles.dtMenos : styles.dtMais].join(' ')}>{valDiff > 0 ? '+' : ''}{fmtBRL(valDiff)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <ResumoSazonalidade detalhes={valDetalhesComAnterior} />
        <div className={styles.gdAdicionar}>
          <button type="button" className={styles.rvSecBtn} disabled={!podeCheckoutDepois}
            title={!podeCheckoutDepois ? tr('O quarto não está livre no dia seguinte') : undefined}
            onClick={() => setEditCheckout(somaDia(editCheckout, 1))}>
            {tr('+ Adicionar diária')}
          </button>
        </div>
      </div>
    );

    const salvarBtns = (
      <div style={{ display: 'flex', gap: 8 }}>
        {hasChanges && (
          <Button variant="primary" disabled={saving} onClick={handleSaveChanges}>
            {saving && <Loader2 size={13} className={styles.spin} />} {tr('Salvar alterações')}
          </Button>
        )}
        {hasChangedData && (
          <Button variant="primary" disabled={!canSave || editSaving} onClick={handleSaveEdit}>
            {editSaving && <Loader2 size={13} className={styles.spin} />} {tr('Salvar Dados')}
          </Button>
        )}
      </div>
    );
    // Gerenciar pessoas fecha pelo X do topo: o rodapé só aparece para salvar.
    const naPessoas = editActiveTab === 'pessoas';
    const semVoltar = naPessoas || editActiveTab === 'dados' || inline;
    // Experimental: no painel a edição abre dentro da própria view, e o resumo
    // financeiro fica na janela flutuante à esquerda, acompanhando cada alteração.
    const tituloEdicao = editActiveTab === 'pessoas' ? tr('Gerenciar pessoas')
      : editActiveTab === 'pagamentos' ? tr('Gerenciar pagamentos') : tr('Gerenciar diárias');

    return (
      <>
      <PainelReserva inline={inline} acao naView={inline} fecharX={editActiveTab !== 'pagamentos'} pagamentos={editActiveTab === 'pagamentos'} estreito={naPessoas && !inline} diarias={editActiveTab === 'dados'} saindo={saindo} open onClose={goBackFromEdit} size="md"
        hideHeader={!inline} title={inline ? tituloEdicao : undefined}
        lateral={inline ? renderValoresResumo({ titulo: tr('Resumo financeiro'), fechar: false }) : null}
        bodyStyle={{ padding: 0, gap: 0 }}
        footer={inline && editActiveTab === 'pagamentos' && !['hospedado', 'finalizado', 'cancelado'].includes(reserva.status) ? (
          <div className={styles.footerRight}>
            <button type="button" className={[styles.rcBtn, styles.rcBtnPay, styles.rcBtnAuto].join(' ')} onClick={() => setShowPayModal(true)}>
              <DollarSign size={15} /> {tr('Registrar pagamento')}
            </button>
            {(hasChanges || hasChangedData) && salvarBtns}
          </div>
        ) : semVoltar ? ((hasChanges || hasChangedData) ? <div className={styles.footerRight}>{salvarBtns}</div> : null) : (
          <div className={styles.footerSpread}>
            <Button variant="secondary" onClick={goBackFromEdit}>{tr('← Voltar')}</Button>
            {salvarBtns}
          </div>
        )}
      >
        <div className={[styles.detailTabContent, editActiveTab !== 'dados' ? styles.detailTabContentAuto : ''].join(' ')}>
        {editActiveTab === 'dados' && (
          <div className={styles.editDadosRoot}>
            {!inline && renderValoresResumo({ titulo: tr('Gerenciar diárias'), semDiarias: true })}

            <div className={styles.editDados}>
              {/* Esquerda — apartamento e período */}
              <div className={[styles.editDadosForm, styles.gdLinha].join(' ')}>
                <div className={styles.editFieldCap}>
                  <RoomCombobox
                    value={editQuarto} onChange={setEditQuarto}
                    availableRooms={editAvailableRooms} categorias={categorias} roomDescMap={roomDescMap} singleSelect
                    loading={editAvailLoading}
                  />
                </div>

                {/* As datas mudam por estes campos; o calendário ao lado só mostra
                    o período escolhido e a ocupação do quarto. */}
                <div className={styles.editDatesGrid}>
                  <FormField label={tr('Check-in')}>
                    <div className={styles.dateCompact}>
                      <DatePicker mode="single" value={editCheckin} sobrio
                        onChange={mudaCheckin}
                        minDate={new Date()}
                        disabledDates={checkinBloqueados}
                        placeholder={tr('Data de check-in')} />
                    </div>
                  </FormField>
                  <FormField label={tr('Check-out')}>
                    <div className={styles.dateCompact}>
                      <DatePicker mode="single" value={editCheckout} sobrio
                        onChange={setEditCheckout}
                        minDate={editCheckin ?? undefined}
                        maxDate={maxCheckout ?? undefined}
                        placeholder={tr('Data de check-out')} />
                    </div>
                  </FormField>
                  {editCheckout && (
                    <div className={styles.meiaDiariaBox}>
                      <label className={styles.empresaModeToggle}>
                        <input type="checkbox" checked={editMeia} disabled={meiaBloqueada && !editMeia}
                          onChange={(e) => {
                            setEditMeia(e.target.checked);
                            if (!e.target.checked) setEditHoraMeia('');
                          }} />
                        <span>{tr('Meia diária')}</span>
                      </label>
                      {editMeia && (
                        <div className={styles.meiaDiariaRow}>
                          <span className={styles.meiaDiariaLabel}>{tr('Hora de saída')}</span>
                          <div className={styles.meiaDiariaInput}>
                            <TimePicker value={editHoraMeia} onChange={setEditHoraMeia} />
                          </div>
                          <span className={temMeiaEdit ? styles.meiaDiariaAviso : styles.meiaDiariaHint}>
                            {meiaBloqueada
                              ? tr('O quarto tem entrada na tarde de {{v0}}', { v0: fmtDateBR(formatDate(editCheckout)) })
                              : temMeiaEdit
                                ? tr('Meio valor da diária de {{v0}}', { v0: fmtDateBR(formatDate(editCheckout)) })
                                : tr('Informe uma hora após o checkout da categoria ({{checkoutCatHora}})', { checkoutCatHora: editCatCheckout })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {renderDiariasTabela()}
          </div>
        )}

        {/* ── Pessoas tab ── */}
        {editActiveTab === 'pessoas' && (() => {
          const editavel = reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'orcamento' && reserva.status !== 'cancelado';
          const orcPessoas = reserva.status === 'orcamento' ? (reserva.pessoasOrcamento ?? []) : [];
          const lista = orcPessoas.length > 0 ? orcPessoas : pessoas;

          // Resultados em caixa flutuante, como no picker do assistente.
          const dropdown = showPessoaDrop && createPortal(
            <div ref={pessoaDropRef} className={styles.searchResultsList}
              style={{ ...pessoaDropStyle, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
              {pendingPessoa ? (
                <>
                  <div className={styles.companionHeader}>
                    <button className={styles.companionBack} onClick={() => setPendingPessoa(null)}><ChevronLeft size={12} /> {tr('Voltar')}</button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <div className={styles.companionRow}>
                      <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
                      <div className={styles.companionInfo}>
                        <span className={styles.companionName}>{pendingPessoa.titular.nome}</span>
                        {pendingPessoa.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pendingPessoa.titular.cpf)}</span>}
                      </div>
                      <span className={styles.titularChip}>{tr('Titular')}</span>
                    </div>
                    {pendingPessoa.titular.acompanhantes.map((a) => (
                      <div key={a.id}
                        className={[styles.companionRow, a.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
                        onClick={() => !a.bloqueado && togglePendingAcomp(a.id)}>
                        <div className={[styles.companionCheck, pendingPessoa.selected.has(a.id) ? styles.companionChecked : ''].join(' ')}>
                          {pendingPessoa.selected.has(a.id) && <Check size={11} />}
                        </div>
                        <div className={styles.companionInfo}>
                          <span className={styles.companionName}>{a.nome}</span>
                          {a.cpf && <span className={styles.companionMeta}>{fmtCpf(a.cpf)}{a.idade ? tr(' · {{idade}} anos', { idade: a.idade }) : ''}</span>}
                        </div>
                        {a.bloqueado && <span className={styles.blockedChip}>{tr('Bloqueado')}</span>}
                      </div>
                    ))}
                  </div>
                  <div className={styles.companionActions}>
                    <button className={styles.companionBtnSecondary} onClick={() => confirmAddPessoas(false)}>{tr('Só o titular')}</button>
                    <button className={styles.companionBtnPrimary} onClick={() => confirmAddPessoas(true)}>{tr('Adicionar →')}</button>
                  </div>
                </>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {pessoaResults.map((p) => (
                    <div key={p.id}
                      className={[styles.searchResultItem, p.bloqueado ? styles.searchResultBlocked : ''].join(' ')}
                      onClick={() => !p.bloqueado && handlePessoaResultClick(p)}>
                      <div className={styles.searchResultName}>{p.nome}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.cpf && <div className={styles.hospedeCpf}>{fmtCpf(p.cpf)}</div>}
                        {p.acompanhantes?.length > 0 && !p.bloqueado && <span className={styles.companionCountChip}>{p.acompanhantes.length} {tr('acomp.')}</span>}
                        {p.bloqueado && <span className={styles.blockedChip}>{tr('Bloqueado')}</span>}
                      </div>
                      <ChevronRight size={13} className={styles.addIcon} />
                    </div>
                  ))}
                </div>
              )}
            </div>,
            document.body
          );

          return (
          <div className={styles.detailBody}>
            {/* Valores — adicionar ou remover pessoa recalcula as diárias */}
            {!inline && renderValoresResumo()}

            {/* Hóspedes — mesma lista do modal de visualização */}
            <div className={styles.rcCard}>
              <div className={styles.rcSection}>
                <div className={styles.rcSectionHead}>
                  <span className={styles.rcSectionLabel}>{tr('Hóspedes')}</span>
                </div>
                {/* Busca — campo do assistente, resultados flutuantes */}
                {editavel && (
                  <div className={styles.gpBusca}>
                    <div ref={pessoaWrapRef} className={styles.hospSearchWrap}>
                      {pessoaSearching
                        ? <Loader2 size={13} className={[styles.hospSearchIcon, styles.spin].join(' ')} />
                        : <Search size={13} className={styles.hospSearchIcon} />}
                      <div className={styles.hospInputInner}>
                        <input className={styles.hospInlineInput} placeholder={tr('Buscar hóspede...')}
                          value={pessoaQuery} onChange={(e) => handlePessoaQuery(e.target.value)} />
                      </div>
                      {pessoaQuery && (
                        <button type="button" className={styles.gpSearchClear}
                          onClick={() => { setPessoaQuery(''); setPessoaResults([]); setPendingPessoa(null); }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {lista.length === 0 ? (
                  <div className={styles.pagEmpty}>{tr('Sem hóspedes vinculados')}</div>
                ) : renderHospedes(lista, editavel && orcPessoas.length === 0 ? (h) => (
                  <div className={styles.rvAcompAcoes}>
                    <BalaoConfirma className={styles.rvSecBtn} label={tr('Tornar titular')} confirmar={tr('Tornar titular')}
                      mensagem={<>{tr('Tornar')} <b>{h.nome}</b> {tr('o titular da reserva?')}</>}
                      onConfirm={() => { handleSetTitular(h.id); onNotify?.(tr('Titular alterado. Salve para aplicar.')); }} />
                    <BalaoConfirma className={[styles.rvSecBtn, styles.rvSecBtnPerigo].join(' ')} label={tr('Remover')} confirmar={tr('Remover')} perigo
                      mensagem={<>{tr('Remover')} <b>{h.nome}</b> {tr('desta reserva?')}</>}
                      onConfirm={() => { handleRemovePessoa(h.id); onNotify?.(tr('Pessoa removida. Salve para aplicar.')); }} />
                  </div>
                ) : null)}
              </div>
            </div>

            {dropdown}
          </div>
          );
        })()}

        {/* ── Pagamentos — mesmo desenho do card da view e do passo "Resumo & Pagamento" ── */}
        {editActiveTab === 'pagamentos' && (() => {
          const editavel = reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado';
          return (
            <div className={styles.rcCard}>
              <div className={[styles.rcSection, styles.rcSectionNoLine].join(' ')}>
                <div className={styles.rcSectionHead}>
                  <span className={styles.rcSectionLabel}>{tr('Pagamentos')}</span>
                  {!inline && (
                    <button type="button" className={styles.rcCloseBtn} onClick={goBackFromEdit} aria-label={tr('Fechar')}>
                      <X size={17} />
                    </button>
                  )}
                </div>
                {inline ? (
                  <div className={styles.dtScroll}>
                    <table className={styles.dtTable}>
                      <thead><tr>
                        <th>{tr('Forma de pagamento & data hora')}</th><th>{tr('Pagador')}</th><th className={styles.dtDir}>{tr('Valor')}</th><th />
                      </tr></thead>
                      <tbody>
                        {pagamentos.length === 0 ? (
                          <tr><td colSpan={4} className={styles.dtVazio}>{tr('Nenhum pagamento registrado.')}</td></tr>
                        ) : pagamentos.map((p) => (
                          <tr key={p.id} className={p.cancelado ? styles.dtCancelado : ''}>
                            <td>
                              <span className={styles.dtForma}>
                                <span className={[styles.finPgIcon, p.cancelado ? styles.finPgIconOff : ''].join(' ')}>{iconePagamento(p.formaPagamento)}</span>
                                <span>
                                  <span className={styles.dtCelTit}>{p.formaPagamento || p.descricao || tr('Pagamento')}</span>
                                  <span className={styles.dtCelSub}>{fmtDataHoraPag(p.dataRegistro)}{p.cancelado ? ` · ${tr('Cancelado')}` : ''}</span>
                                </span>
                              </span>
                            </td>
                            <td className={[styles.dtQuebra, styles.dtPagador].join(' ')}>{p.nomePagador || '—'}</td>
                            <td className={[styles.dtDir, styles.dtValor].join(' ')}>{fmtBRL(p.valor)}</td>
                            <td className={styles.dtSetaCel}>
                              <button type="button" className={styles.dtSeta} onClick={() => setViewPagamento(p)} title={tr('Ver detalhes')} aria-label={tr('Ver detalhes')}>
                                <ChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : pagamentos.length === 0 && <div className={styles.pagEmpty}>{tr('Nenhum pagamento registrado.')}</div>}
                {!inline && pagamentos.map((p) => (
                  <div key={p.id}
                    className={[styles.step3PagRow, styles.pagCardClickable, p.cancelado ? styles.rvPayItemCancelado : ''].join(' ')}
                    onClick={() => setViewPagamento(p)}>
                    <div className={styles.step3PagRowTop}>
                      <span className={styles.step3PagDesc}>{p.descricao || p.formaPagamento || tr('Pagamento')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                        <span className={p.cancelado ? styles.pagCardValorCancelado : styles.step3PagVal}>{fmtBRL(p.valor)}</span>
                        {!p.cancelado && editavel && (
                          <button className={styles.removeIconBtn} title={tr('Cancelar pagamento')}
                            onClick={(e) => { e.stopPropagation(); setCancelPagId(p.id); setCancelMotivo(''); setBalao({ tipo: 'cancelarPag', anchor: e.currentTarget }); }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    {(p.dataRegistro || p.formaPagamento) && (
                      <div className={styles.step3PagMeta}>{[p.dataRegistro, p.formaPagamento].filter(Boolean).join(' · ')}</div>
                    )}
                    {p.nomePagador && <div className={styles.step3PagMeta}>{p.nomePagador}</div>}
                    {p.funcionario && <div className={styles.step3PagMeta}>{tr('registrado por')} {p.funcionario}</div>}
                    {p.cancelado && <span className={styles.pagCardCanceladoBadge}>{tr('Cancelado')}</span>}
                  </div>
                ))}

                {!inline && renderValoresLista()}
              </div>

              {editavel && !inline && (
                <div className={styles.rcActions}>
                  <button type="button" className={[styles.rcBtn, styles.rcBtnPay].join(' ')}
                    onClick={() => setShowPayModal(true)}>
                    <DollarSign size={15} /> {tr('Registrar pagamento')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        </div>
      </PainelReserva>

      {!inline && renderBalao()}

      <Modal open={!!confirmRemovePessoa} onClose={() => setConfirmRemovePessoa(null)} size="sm" title={tr('Remover pessoa')}
        footer={<div style={{ display: 'flex', gap: 8 }}><Button style={{ flex: 1 }} onClick={() => setConfirmRemovePessoa(null)}>{tr('Cancelar')}</Button><Button variant="danger" style={{ flex: 1 }} onClick={() => { handleRemovePessoa(confirmRemovePessoa.id); setConfirmRemovePessoa(null); }}>{tr('Remover')}</Button></div>}
      ><p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{tr('Tem certeza que deseja remover')} <b>{confirmRemovePessoa?.nome}</b> {tr('desta reserva?')}</p></Modal>

      {inline ? (showPayModal && (
        <PainelReserva inline acao pag open onClose={fecharPag}
          title={<><DollarSign size={15} /> {pagRegistrado ? tr('Pagamento registrado') : tr('Registrar pagamento')}</>}
          footer={pagRegistrado ? (
            <>
              <Button className={styles.btnSolid} onClick={() => setPagRegistrado(null)}>{tr('Registrar outro')}</Button>
              <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')} onClick={fecharPag}>{tr('Concluir')}</Button>
            </>
          ) : null}>
          {pagRegistrado ? (
            <div className={styles.pagRecibo}>
              <span className={styles.pagReciboOk}><Check size={22} /></span>
              <p className={styles.pagReciboValor}>{fmtBRL(pagRegistrado.valor)}</p>
              <div className={styles.pagReciboLista}>
                <div><span>{tr('Forma')}</span><b className={styles.pagReciboForma}><span className={styles.finPgIcon}>{iconePagamento(pagRegistrado.formaPagamento)}</span>{pagRegistrado.formaPagamento || '—'}</b></div>
                <div><span>{tr('Pagador')}</span><b>{pagRegistrado.nomePagador || '—'}</b></div>
                {pagRegistrado.descricao && <div><span>{tr('Descrição')}</span><b>{pagRegistrado.descricao}</b></div>}
                <div><span>{tr('Data')}</span><b>{pagRegistrado.dataRegistro}</b></div>
              </div>
              <p className={styles.pagReciboAviso}>{tr('O pagamento entra na reserva ao clicar em Salvar.')}</p>
            </div>
          ) : (
            <PaymentModal inline compacto open onClose={fecharPag} onConfirm={handleAddPagamento} tiposPagamento={tiposPagamento} isSubmitting={false} titularNome={reserva.titularNome} lastPayerName={pagamentos.filter(p => !p.cancelado).at(-1)?.nomePagador ?? null} canAplicarDesconto={false} valorTotal={reserva.valorTotal} valorPago={totalPago} />
          )}
        </PainelReserva>
      )) : (
        <PaymentModal open={showPayModal} onClose={() => setShowPayModal(false)} onConfirm={handleAddPagamento} tiposPagamento={tiposPagamento} isSubmitting={false} titularNome={reserva.titularNome} lastPayerName={pagamentos.filter(p => !p.cancelado).at(-1)?.nomePagador ?? null} canAplicarDesconto={false} valorTotal={reserva.valorTotal} valorPago={totalPago} />
      )}

      <Modal open={showDiscard} onClose={() => setShowDiscard(false)} size="sm" title={tr('Descartar alterações?')}
        footer={<div className={styles.footerRight}><Button variant="secondary" onClick={() => setShowDiscard(false)}>{tr('Continuar editando')}</Button><Button variant="danger" onClick={() => { setShowDiscard(false); discardPendingOps(); setEditing(false); setEditActiveTab('dados'); }}>{tr('Descartar')}</Button></div>}
      ><p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>{tr('Há alterações não salvas. Deseja descartá-las?')}</p></Modal>

      <Modal open={!!viewPagamento && !inline} onClose={() => setViewPagamento(null)} size="sm" title={tr('Detalhes do Pagamento')}
        footer={<div className={styles.footerRight}><Button onClick={() => setViewPagamento(null)}>{tr('Fechar')}</Button></div>}
      >
        {viewPagamento && (
          <div className={styles.kvDetailRoot}>
            <div className={styles.kvSectionDivider}>{tr('Pagamento')}</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Forma')}</span><span className={styles.kvVal}>{viewPagamento.formaPagamento || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Valor')}</span><span className={[styles.kvVal, viewPagamento.cancelado ? styles.pagCardValorCancelado : styles.finPago].join(' ')}>{fmtBRL(viewPagamento.valor)}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Pagador')}</span><span className={styles.kvVal}>{viewPagamento.nomePagador || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Situação')}</span><span className={viewPagamento.cancelado ? styles.pagCardCanceladoBadge : styles.pagStatusAtivo}>{viewPagamento.cancelado ? tr('Cancelado') : tr('Ativo')}</span></div>
              {viewPagamento.descricao && <div className={[styles.kvRow, styles.kvRowFull].join(' ')}><span className={styles.kvLabel}>{tr('Descrição')}</span><span className={styles.kvVal}>{viewPagamento.descricao}</span></div>}
            </div>
            <div className={styles.kvSectionDivider}>{tr('Registro')}</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Registrado por')}</span><span className={styles.kvVal}>{viewPagamento.funcionario || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Data')}</span><span className={styles.kvVal}>{viewPagamento.dataRegistro || '—'}</span></div>
            </div>
            {viewPagamento.cancelado && (
              <>
                <div className={styles.kvSectionDividerCancel}>{tr('Cancelamento')}</div>
                <div className={styles.kvListCancel}>
                  <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Cancelado por')}</span><span className={styles.kvVal}>{viewPagamento.funcMotivo || '—'}</span></div>
                  <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Data')}</span><span className={styles.kvVal}>{viewPagamento.dataMotivo || '—'}</span></div>
                  {viewPagamento.motivoCancelamento && <div className={[styles.kvRow, styles.kvRowFull].join(' ')}><span className={styles.kvLabel}>{tr('Motivo')}</span><span className={styles.kvVal}>{viewPagamento.motivoCancelamento}</span></div>}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      </>
    );
  };
  if (editing && !inline) return renderEdicao();

  // ── View mode render ───────────────────────────────────────────────────────
  const todayStr = formatDate(new Date());
  // Pode hospedar quando o check-in é hoje ou já passou (inclui reservas com checkout vencido).
  // Nunca quando o check-in é no futuro — salvo allowHospedarAnytime (Recepção: hóspede no balcão).
  const canCheckin = allowHospedarAnytime || reserva.dataInicio <= todayStr;
  const roomDesc = roomDescMap[reserva.quarto] || roomDescMap[String(reserva.quarto)] || '';
  const catNome = cat?.nome || reserva.categoria || '';
  const displayTotal = reserva.valorTotal;
  const displayPendente = Math.max(0, displayTotal - totalPago);
  const checkinTime = reserva.chegadaPrevista?.split(' ')[1]?.slice(0, 5) || '12:00';
  const checkoutTime = reserva.saidaPrevista?.split(' ')[1]?.slice(0, 5) || '12:00';

  // Diárias do card de preço: no pernoite vêm prontas da Recepção; na reserva, das diárias
  // gravadas. O /calcular-preco só aparece aqui como fallback de registro sem diárias.
  const diariasDaReserva = detalhesDasDiarias(reserva.diarias, pessoas, reserva.dataInicio);
  const effectiveDetalhes = isOvernight
    ? (overnight.diariasDetalhes ?? [])
    : (diariasDaReserva.length > 0 ? diariasDaReserva : (infoCalc?.detalhes ?? []));

  // Diárias vindas do banco já trazem o ajuste "por diária" embutido — nesse modo o back-end
  // sobrescreve diaria.valor. Aplicá-lo de novo aqui cobraria o desconto duas vezes. Só quando
  // os valores vêm do /calcular-preco (preço base, sem ajuste) é que ele precisa ser somado.
  const detalhesPersistidos = isOvernight || diariasDaReserva.length > 0;

  // Ajuste manual persistido ("Gerenciar Preços"). No modo "Por diária" o desconto/adicional
  // aparece em cada diária; nos demais, em uma linha única. O total resultante vai para o box "Total".
  const priceAdj    = reserva.novoPreco ? novoPrecoToState(reserva.novoPreco) : null;
  const baseDiarias = effectiveDetalhes.map((d) => ({ valor: d.valor_final ?? 0 }));
  const baseTotal   = baseDiarias.reduce((s, d) => s + d.valor, 0);
  const isDiariaAdj = priceAdj?.mode === 'diaria' && !detalhesPersistidos;
  const adjResult   = (priceAdj && !(priceAdj.mode === 'diaria' && detalhesPersistidos))
    ? computeAdjustedTotal({ baseTotal, baseDiarias, ...priceAdj })
    : null;
  const cardTotal   = effectiveDetalhes.length > 0
    ? (adjResult ? adjResult.valorTotal : baseTotal)
    : displayTotal;

  // Lista de pessoas exibida (suporta orçamento sem cadastro).
  const guestList =
    (reserva.status === 'orcamento' && (reserva.pessoasOrcamento?.length ?? 0) > 0)
      ? reserva.pessoasOrcamento
      : (reserva.status === 'orcamento' && reserva.orcamentoInfo && pessoas.length === 0)
        ? [{ id: 0, nome: reserva.orcamentoInfo.nome_solicitante }]
        : (isOvernight ? pessoas : (reserva.hospedes ?? []));

  // Cabeçalho do card: descrição do apartamento (ou categoria) como chip.
  const headChip   = roomDesc || catNome;
  // Sem saldo em aberto o bloco "Pendente" some e as colunas se reajustam.
  const temPendente = displayPendente > 0.005;

  // ── Valores no mesmo desenho do passo "Resumo & Pagamento" ────────────────
  // Valor da diária no modo "Por diária" (o ajuste substitui o valor original).
  const diariaAdjValor = isDiariaAdj
    ? (adjResult?.diarias?.[0]?.valor ?? Math.max(0, Math.round((Number(priceAdj.value) || 0) * 100) / 100))
    : null;
  // Uma diária só que já vale o total: a linha da diária repete o valor e o "Total" some.
  const valorUnicoDiaria = effectiveDetalhes.length === 1
    ? (isDiariaAdj ? diariaAdjValor : (effectiveDetalhes[0].valor_final ?? 0))
    : null;
  const totalRedundante = valorUnicoDiaria !== null && Math.abs(cardTotal - valorUnicoDiaria) < 0.005;
  // Quitado: as diárias ficam verdes e ganham o selo "(pago 100%)".
  // Pagamento único do grupo: o lançamento cobre todas as reservas e pertence ao
  // grupo, não a este apartamento. Aqui ficam só as diárias — lista de pagamentos,
  // pago/pendente e o selo de quitado saem de cena, e o acerto é feito em
  // "Grupos", único lugar que lança pagamento do grupo.
  const pagamentoDeGrupo = pagamentos.some((p) => !p.cancelado && p.grupoId != null);
  const pagoIntegral = !pagamentoDeGrupo && cardTotal > 0 && totalPago >= cardTotal - 0.005;

  // Reserva em aberto: as opções (Hospedar, Voucher, edição…) ficam no período, ao lado das pessoas.
  const temOpcoes = !isOvernight && !['orcamento', 'solicitada', 'hospedado', 'finalizado', 'cancelado', 'ausente'].includes(reserva.status);
  // Hospedado/finalizado: sobra só o Voucher, que ocupa o mesmo lugar das opções.
  const soVoucher = !isOvernight && ['hospedado', 'finalizado', 'ausente'].includes(reserva.status);
  // Botões fixos no rodapé da view: pagamento, hospedar e o menu com as demais opções.
  const rodapeEl = temOpcoes ? (
    <div className={styles.rvRodape}>
      <button type="button" className={styles.rvRodapeBtn} disabled={pagamentoDeGrupo}
        title={pagamentoDeGrupo ? tr('Pagamento único do grupo — acerte por "Grupos"') : undefined}
        onClick={() => { setAcoesOpen(false); setEditActiveTab('pagamentos'); setEditing(true); setShowPayModal(true); }}>
        {tr('Pagamento')}
      </button>
      <button type="button" className={[styles.rvRodapeBtn, styles.rvRodapeHospedar].join(' ')}
        disabled={!canCheckin || voucherLoading}
        title={!canCheckin ? tr('Check-in: {{v0}}', { v0: fmtDateBR(reserva.dataInicio) }) : undefined}
        onClick={(e) => { setAcoesOpen(false); setBalao({ tipo: 'hospedar', anchor: e.currentTarget }); }}>
        {tr('Hospedar')}
      </button>
      <div className={styles.rvRodapeMais}>
        {acoesOpen && (
          <>
            <div className={styles.rvAcoesBackdrop} onClick={() => setAcoesOpen(false)} />
            <div className={styles.rvRodapeMenu} role="menu">
              <button className={styles.rvAcoesItem} disabled={voucherLoading}
                onClick={() => { setAcoesOpen(false); handleVoucherClick(setaRef.current); }}>
                <FileDown size={15}/> {tr('Voucher')}
              </button>
              <button className={styles.rvAcoesItem} onClick={() => { setAcoesOpen(false); setEditActiveTab('dados'); setEditing(true); }}>
                <Pencil size={15}/> {tr('Gerenciar diárias')}
              </button>
              <div className={styles.rvAcoesDiv} />
              <button className={styles.rvAcoesItem} onClick={() => { setAcoesOpen(false); setEditActiveTab('pessoas'); setEditing(true); }}>
                <Users size={15}/> {tr('Gerenciar pessoas')}
              </button>
              <button className={styles.rvAcoesItem}
                disabled={pagamentoDeGrupo}
                title={pagamentoDeGrupo ? tr('Pagamento único do grupo — acerte por "Grupos"') : undefined}
                onClick={() => { setAcoesOpen(false); setEditActiveTab('pagamentos'); setEditing(true); }}>
                <DollarSign size={15}/> {tr('Gerenciar pagamentos')}
              </button>
              <button className={styles.rvAcoesItem} onClick={() => { setAcoesOpen(false); openGerenciarPreco(); }}>
                <Tag size={15}/> {tr('Gerenciar preços')}
              </button>
              <div className={styles.rvAcoesDiv} />
              {reserva.status === 'confirmada' && (
                <button className={styles.rvAcoesItem}
                  onClick={() => { setAcoesOpen(false); setBalao({ tipo: 'ausente', anchor: setaRef.current }); }}>
                  <UserX size={15}/> {tr('Marcar como ausente')}
                </button>
              )}
              <button className={[styles.rvAcoesItem, styles.rvAcoesItemDanger].join(' ')}
                onClick={() => { setAcoesOpen(false); setCancelMotivRes(''); setBalao({ tipo: 'cancelar', anchor: setaRef.current }); }}>
                <Trash2 size={14}/> {tr('Cancelar reserva')}
              </button>
            </div>
          </>
        )}
        <button ref={setaRef} type="button" className={styles.rvRodapeBtn}
          onClick={() => setAcoesOpen((v) => !v)} aria-haspopup="menu" aria-expanded={acoesOpen}>
          {tr('Opções')} {voucherLoading ? <Loader2 size={15} className={styles.spin}/> : <ChevronDown size={15} className={acoesOpen ? styles.rvAcoesBtnChevronOpen : styles.rvAcoesBtnChevron} />}
        </button>
      </div>
    </div>
  ) : soVoucher ? (
    <div className={styles.rvRodape}>
      <button type="button" className={styles.rvRodapeBtn} disabled={voucherLoading} onClick={handleVoucherClick}>
        {voucherLoading ? <Loader2 size={15} className={styles.spin}/> : <FileDown size={15}/>} {voucherLoading ? tr('Gerando...') : tr('Voucher')}
      </button>
    </div>
  ) : null;

  const resumoFinEl = (pagamentos.length > 0 || effectiveDetalhes.length > 0 || cardTotal > 0 || groupInfo) && (() => {
            // Mesmo desenho da aba Pagamentos: lançamentos, diárias agrupadas, total e pendente.
            const ajuste    = baseTotal > 0 ? cardTotal - baseTotal : 0;
            const grupos    = groupDiarias(effectiveDetalhes, isDiariaAdj ? () => diariaAdjValor : null);
            const pendente  = Math.max(0, cardTotal - totalPago);
            const pagosLista = pagamentoDeGrupo ? [] : pagamentos.filter((p) => !p.cancelado);
            const pctPago    = cardTotal > 0 ? Math.min(100, Math.round((totalPago / cardTotal) * 100)) : 0;
            return (
              <aside className={[styles.finResumo, styles.finResumoView].join(' ')}>
                <div className={styles.finCab}>
                  <h4 className={styles.finTit}>{tr('Resumo financeiro')}</h4>
                </div>
                {grupos.map((g) => {
                  const hospedes = diariaSubs({ ...g, saz: null });
                  return (
                    <div key={g.key} className={styles.finLinha}>
                      <span className={styles.finLinhaTxt}>
                        {g.qtd > 1
                          ? tr('{{qtd}} diárias × {{valor}}', { qtd: g.qtd, valor: fmtBRL(g.valor) })
                          : g.meia ? tr('Meia diária') : grupos.length > 1 ? tr('{{n}}ª Diária', { n: g.numeros[0] }) : tr('Diária')}
                        {hospedes && <small className={styles.finSub}>{hospedes}</small>}
                        {g.saz && <small className={styles.finSub}>{tr('Sazonalidade aplicada: {{saz}}', { saz: g.saz })}</small>}
                      </span>
                      <b>{fmtBRL(g.valor * g.qtd)}</b>
                    </div>
                  );
                })}
                {grupos.length === 0 && (
                  <div className={styles.finLinha}><span>{tr('Diárias')}</span><b>{fmtBRL(cardTotal)}</b></div>
                )}
                {priceAdj && !isDiariaAdj && Math.abs(ajuste) >= 0.005 && (
                  <div className={styles.finLinha}><span>{describeAdjustment(priceAdj)}</span><b>{ajuste > 0 ? '+' : ''}{fmtBRL(ajuste)}</b></div>
                )}
                {(pagamentoDeGrupo || cardTotal <= 0) && (
                  <>
                    <hr className={styles.finSep} />
                    <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Total')}</span><b>{fmtBRL(cardTotal)}</b></div>
                  </>
                )}
                {pagosLista.map((p) => (
                  <div key={p.id} className={[styles.finLinha, styles.finPago].join(' ')}>
                    <span className={styles.finLinhaTxt}>
                      {p.descricao || p.formaPagamento || tr('Pagamento')}
                      {p.dataRegistro && <small className={styles.finSub}>{String(p.dataRegistro).slice(0, 16)}</small>}
                    </span>
                    <b>{fmtBRL(p.valor)}</b>
                  </div>
                ))}
                {!pagamentoDeGrupo && cardTotal > 0 && (
                  <div className={styles.finProg}>
                    <div className={styles.finProgBarra}><span style={{ width: `${pctPago}%` }} /></div>
                    <div className={styles.finProgLeg}>
                      <span>{pctPago}%</span>
                      <span>{tr('Total de {{total}}', { total: fmtBRL(cardTotal) })}</span>
                    </div>
                  </div>
                )}
                {!pagamentoDeGrupo && (pagoIntegral ? (
                  <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
                ) : pendente > 0.005 && (
                  <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(pendente)}</b></div>
                ))}

          {groupInfo && (() => {
            const grpQuitado = groupInfo.total > 0 && groupInfo.pago >= groupInfo.total - 0.005;
            const aptsLabel  = `${groupInfo.count} apt${groupInfo.count !== 1 ? 's' : ''}`;
            return (
              <div className={[styles.rcResumoList, styles.rcResumoGrupo].join(' ')}>
                {grpQuitado ? (
                  <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                    <span>{tr('Total pago · grupo (')}{aptsLabel})</span><span>{fmtBRL(groupInfo.pago)}</span>
                  </div>
                ) : (
                  <>
                    <div className={styles.rcResumoRow}>
                      <span>{tr('Total · grupo (')}{aptsLabel})</span><span>{fmtBRL(groupInfo.total)}</span>
                    </div>
                    {groupInfo.pago > 0.005 && (
                      <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                        <span>{tr('Pago · grupo')}</span><span>{fmtBRL(groupInfo.pago)}</span>
                      </div>
                    )}
                    {groupInfo.pendente > 0.005 && (
                      <div className={[styles.rcResumoRow, styles.rcResumoDanger].join(' ')}>
                        <span>{tr('Pendente · grupo')}</span><span>{fmtBRL(groupInfo.pendente)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

              </aside>
            );
          })();

  return (
    <>
      {/* Card único no mesmo desenho do passo "Resumo & Pagamento" da criação. */}
      {!((editing || showAdjPreco) && inline) && (
      <PainelReserva inline={inline} saindo={saindo} open onClose={handleClose} size="lg" hideHeader closeOnBackdrop
        footer={rodapeEl} lateral={inline ? resumoFinEl : null}
        bodyStyle={{ padding: '14px 16px 16px', gap: 12 }}
        containerStyle={{ maxWidth: overnight ? 'min(466px, 96vw)' : 'min(565px, 96vw)' }}
      >
        <div className={[styles.rcCard, reserva.status === 'cancelado' ? styles.rvCancelado : ''].join(' ')}>

          {/* ── Apartamento ── */}
          <div className={styles.rcHead}>
            <div className={styles.rcHeadLeft}>
              <div className={styles.rcHeadTop}>
                <span className={styles.rcTitle}>{tr('Apartamento')} {fmtRoom(reserva.quarto)}</span>
                {reserva.status === 'cancelado' && (
                  <span className={[styles.rcChip, styles.rcChipRed].join(' ')}>{tr('Cancelada')}</span>
                )}
                {headChip && <span className={styles.rcChip}>{headChip}</span>}
              </div>
              {reserva.funcionario && (
                <span className={styles.rcHeadMeta}>{tr('registrado por')} {reserva.funcionario}</span>
              )}
            </div>
            <div className={styles.rcHeadRight}>
              <span className={styles.rcHeadMeta}>#{reserva.id}</span>
              <button type="button" className={styles.rcCloseBtn} onClick={handleClose} aria-label={tr('Fechar')}>
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ── Período — acima dos hóspedes, em linha cheia ── */}
          <div className={[styles.rcSection, styles.rvDestaque].join(' ')}>
            <div className={[styles.rcPeriodRow, styles.rvPeriodRowFull].join(' ')}>
              <div className={styles.ovDateCell}>
                <div className={styles.ovDateLabel}>{tr('Check-in')}</div>
                <div className={styles.ovDateValue}>{toBrDate(reserva.dataInicio)}</div>
                <div className={styles.ovDateTime}>{checkinTime}{tr('h')}</div>
              </div>
              <div className={styles.ovDateArrow}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              <div className={[styles.ovDateCell, styles.ovDateCellRight].join(' ')}>
                <div className={styles.ovDateLabel}>{tr('Check-out')}</div>
                <div className={styles.ovDateValue}>{toBrDate(reserva.dataFim)}</div>
                <div className={styles.ovDateTime}>{checkoutTime}{tr('h')}</div>
              </div>
              <div className={styles.ovNightsCell}>
                <div className={styles.ovNightsNum}>{dias}</div>
                <div className={styles.ovNightsLabel}>{dias === 1 ? tr('Diária') : tr('Diárias')}</div>
              </div>
              {guestList.length > 0 && (
                <div className={styles.ovNightsCell}>
                  <div className={styles.ovNightsNum}>{guestList.length}</div>
                  <div className={styles.ovNightsLabel}>{guestList.length === 1 ? tr('Pessoa') : tr('Pessoas')}</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.rvCorpo}>
          <div className={styles.rvCorpoMain}>
          {/* ── Hóspedes ── */}
          <div className={styles.rcSection}>
            <div className={styles.rcSectionHead}>
              <span className={styles.rcSectionLabel}>{tr('Hóspedes')}</span>
              {temOpcoes && (
                <button type="button" className={styles.rvSecBtn}
                  onClick={() => { setAcoesOpen(false); setEditActiveTab('pessoas'); setEditing(true); }}>
                  {tr('Gerenciar pessoas')}
                </button>
              )}
            </div>
            {guestList.length === 0 ? (
              <div className={styles.pagEmpty}>{tr('Sem hóspedes vinculados')}</div>
            ) : (
              renderHospedes(guestList)
            )}
          </div>

          </div>
          {!inline && resumoFinEl}
          </div>
          {/* ── Diárias — tabela no desenho do histórico de hospedagem ── */}
          {effectiveDetalhes.length > 0 && (() => {
            const aggDiff    = cardTotal - baseTotal;
            const funcAjuste = reserva.novoPreco?.funcionario?.nome;
            return (
              <div className={styles.rcSection}>
                <div className={styles.rcSectionHead}>
                  <span className={styles.rcSectionLabel}>{tr('Diárias')}</span>
                  {temOpcoes && (
                    <button type="button" className={styles.rvSecBtn}
                      onClick={() => { setAcoesOpen(false); setEditActiveTab('dados'); setEditing(true); }}>
                      {tr('Gerenciar diárias')}
                    </button>
                  )}
                </div>
                <div className={styles.dtScroll}>
                  <table className={styles.dtTable}>
                    <thead><tr>
                      <th>{tr('Nº')}</th><th>{tr('Período')}</th><th>{tr('Ocupação')}</th><th className={styles.dtDir}>{tr('Valor')}</th>
                    </tr></thead>
                    <tbody>
                      {effectiveDetalhes.map((d, i) => {
                        const ini   = addDaysStr(reserva.dataInicio, i);
                        const orig  = d.valor_final ?? 0;
                        const valor = isDiariaAdj ? diariaAdjValor : orig;
                        return (
                          <tr key={i}>
                            <td><span className={styles.dtNum}>{String(i + 1).padStart(2, '0')}</span></td>
                            <td>{periodoDiaria(d.descricao) ? periodoDiaria(d.descricao).replace(/(\d{2}\/\d{2})\/\d{4}/g, '$1').replace(/\s*->\s*/, ' → ') : `${fmtDiaMes(ini)} → ${fmtDiaMes(addDaysStr(ini, 1))}`}</td>
                            <td className={styles.dtQuebra}>
                              {normalizaAdultos(descricaoHospedes(d.descricao)) || '—'}
                              {d.meia_diaria && <span className={styles.dtTag}>{tr('Meia diária')}</span>}
                            </td>
                            <td className={[styles.dtDir, styles.dtValor].join(' ')}>
                              {isDiariaAdj && Math.abs(valor - orig) >= 0.005 && <span className={styles.rcDiariaOld}>{fmtBRL(orig)}</span>}
                              {fmtBRL(valor)}
                            </td>
                          </tr>
                        );
                      })}
                      {priceAdj && !isDiariaAdj && Math.abs(aggDiff) >= 0.005 && (
                        <tr>
                          <td colSpan={3}>{describeAdjustment(priceAdj)}{funcAjuste ? tr(' · por {{funcAjuste}}', { funcAjuste }) : ''}</td>
                          <td className={[styles.dtDir, aggDiff < 0 ? styles.dtMenos : styles.dtMais].join(' ')}>
                            {aggDiff > 0 ? '+' : ''}{fmtBRL(aggDiff)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <ResumoSazonalidade detalhes={effectiveDetalhes} />
              </div>
            );
          })()}

          {/* ── Pagamentos ── */}
          {!pagamentoDeGrupo && (
            <div className={styles.rcSection}>
              <div className={styles.rcSectionHead}>
                <span className={styles.rcSectionLabel}>{tr('Pagamentos')}</span>
                {temOpcoes && (
                  <button type="button" className={styles.rvSecBtn}
                    onClick={() => { setAcoesOpen(false); setEditActiveTab('pagamentos'); setEditing(true); }}>
                    {tr('Gerenciar pagamentos')}
                  </button>
                )}
              </div>
              <div className={styles.dtScroll}>
                <table className={styles.dtTable}>
                  <thead><tr>
                    <th>{tr('Forma de pagamento & data hora')}</th><th>{tr('Pagador')}</th><th className={styles.dtDir}>{tr('Valor')}</th><th />
                  </tr></thead>
                  <tbody>
                    {pagamentos.length === 0 ? (
                      <tr><td colSpan={4} className={styles.dtVazio}>{tr('Nenhum pagamento registrado.')}</td></tr>
                    ) : pagamentos.map((p) => (
                      <tr key={p.id} className={p.cancelado ? styles.dtCancelado : ''}>
                        <td>
                          <span className={styles.dtForma}>
                            <span className={[styles.finPgIcon, p.cancelado ? styles.finPgIconOff : ''].join(' ')}>{iconePagamento(p.formaPagamento)}</span>
                            <span>
                              <span className={styles.dtCelTit}>{p.formaPagamento || p.descricao || tr('Pagamento')}</span>
                              <span className={styles.dtCelSub}>{fmtDataHoraPag(p.dataRegistro)}{p.cancelado ? ` · ${tr('Cancelado')}` : ''}</span>
                            </span>
                          </span>
                        </td>
                        <td className={[styles.dtQuebra, styles.dtPagador].join(' ')}>{p.nomePagador || '—'}</td>
                        <td className={[styles.dtDir, styles.dtValor].join(' ')}>{fmtBRL(p.valor)}</td>
                        <td className={styles.dtSetaCel}>
                          <button type="button" className={styles.dtSeta} onClick={() => setViewPagamento(p)} title={tr('Ver detalhes')} aria-label={tr('Ver detalhes')}>
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Cancelamento / Observação ── */}
          {reserva.status === 'cancelado' && reserva.motivoCancelamento ? (
            <div className={[styles.rcSection, styles.rvCancelSection].join(' ')}>
              <div className={styles.rcSectionHead}>
                <span className={[styles.rcSectionLabel, styles.rvCancelLabel].join(' ')}>
                  <XCircle size={12} style={{ flexShrink: 0 }} /> {tr('Motivo do cancelamento')}
                </span>
              </div>
              <div className={styles.rvObsText}>{reserva.motivoCancelamento}</div>
              {(reserva.funcMotivo || reserva.dataMotivo) && (
                <div className={styles.rvCancelMeta}>
                  {[reserva.funcMotivo && `por ${reserva.funcMotivo}`, reserva.dataMotivo]
                    .filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ) : (reserva.observacao || temOpcoes) ? (
            <div className={styles.rcSection}>
              <div className={styles.rcSectionHead}>
                <span className={styles.rcSectionLabel}>{tr('Observação')}</span>
                {temOpcoes && !obsAberta && (
                  <button type="button" className={styles.rvSecBtn}
                    onClick={() => { setAcoesOpen(false); setObsTexto(reserva.observacao ?? ''); setObsAberta(true); }}>
                    {tr('Alterar observação')}
                  </button>
                )}
              </div>
              {obsAberta ? (
                <div className={styles.rvObsEdit}>
                  <textarea className={styles.motivoTextarea} rows={3} autoFocus
                    placeholder={tr('Observação sobre a reserva...')}
                    value={obsTexto} onChange={(e) => setObsTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setObsAberta(false); } }} />
                  <div className={styles.footerRight}>
                    <Button variant="secondary" disabled={obsSaving} onClick={() => setObsAberta(false)}>{tr('Cancelar')}</Button>
                    <Button variant="primary" disabled={obsSaving || obsTexto.trim() === (reserva.observacao ?? '').trim()} onClick={handleSaveObs}>
                      {obsSaving && <Loader2 size={13} className={styles.spin} />} {tr('Salvar')}
                    </Button>
                  </div>
                </div>
              ) : reserva.observacao
                ? <div className={styles.rvObsText}>{reserva.observacao}</div>
                : <div className={styles.pagEmpty}>{tr('Sem observação')}</div>}
            </div>
          ) : null}

        </div>

        {/* ── Ações — fora do card, no rodapé do modal. Cancelada não tem ação
               própria: sem voucher e sem limpeza a faixa nem aparece. ── */}
        {!(reserva.status === 'cancelado' && !limpezaBtnInfo && !isOvernight) && !((temOpcoes || soVoucher) && !limpezaBtnInfo) && (
        <div className={[styles.rcActions, styles.rcActionsCenter].join(' ')}>
          {limpezaBtnInfo && (
            <button className={styles.rvBtn} style={{ color: '#2563eb', borderColor: 'rgba(37,99,235,0.35)' }}
              disabled={voucherLoading}
              onClick={() => limpezaBtnInfo.onFinalizar()}
              title={limpezaBtnInfo.responsavel ? tr('Limpeza: {{responsavel}}', { responsavel: limpezaBtnInfo.responsavel }) : undefined}>
              <Check size={14} /> {tr('Finalizar Limpeza')}{limpezaBtnInfo.responsavel ? ` · ${limpezaBtnInfo.responsavel}` : ''}
            </button>
          )}
          {isOvernight ? (() => {
            // Menu Ações dirigido por lista — único botão, itens conforme o contexto
            // (pernoite usa os callbacks padrão; reservado/etc. passam overnight.acoes).
            const acoesItems = (overnight.acoes ?? [
              overnight.onAcionarLimpeza      && { label: tr('Acionar Limpeza'),      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M3 21h18"/><path d="M7 21V11l5-4 5 4v10"/><path d="M10 21v-4h4v4"/></svg>, onClick: overnight.onAcionarLimpeza },
              overnight.onGerenciarDiarias    && { label: tr('Gerenciar Diárias'),    icon: <CalendarDays size={15}/>, onClick: overnight.onGerenciarDiarias },
              overnight.onAdicionarConsumo    && { label: tr('Adicionar Consumo'),    icon: <Plus size={15}/>,        onClick: overnight.onAdicionarConsumo },
              overnight.onGerenciarPagamentos && { label: tr('Gerenciar Pagamentos'), icon: <DollarSign size={15}/>,  onClick: overnight.onGerenciarPagamentos },
              overnight.onGerenciarPreco      && { label: tr('Gerenciar Preços'),     icon: <Tag size={15}/>,         onClick: overnight.onGerenciarPreco },
              overnight.onGerenciarPessoas    && { label: tr('Gerenciar Pessoas'),    icon: <Users size={15}/>,       onClick: overnight.onGerenciarPessoas },
              overnight.onVoucher             && { label: tr('Voucher'),              icon: <FileDown size={15}/>,    onClick: overnight.onVoucher },
              overnight.onFinalizar           && { label: tr('Finalizar Pernoite'),   icon: <Check size={15}/>,       onClick: overnight.onFinalizar, primary: true, divider: true },
              overnight.onCancelar            && { label: tr('Cancelar Pernoite'),    icon: <XCircle size={14}/>,     onClick: overnight.onCancelar,  danger: true },
            ]).filter(Boolean);
            return (
              <div className={styles.rvAcoesWrap}>
                {acoesOpen && (
                  <>
                    <div className={styles.rvAcoesBackdrop} onClick={() => setAcoesOpen(false)} />
                    <div className={styles.rvAcoesMenu}>
                      <div className={styles.rvAcoesTit}>{tr('Opções')}</div>
                      {acoesItems.map((a, i) => (
                        <Fragment key={i}>
                          {a.divider && <div className={styles.rvAcoesDiv} />}
                          <button
                            className={[styles.rvAcoesItem, a.primary ? styles.rvAcoesItemPrimary : '', a.danger ? styles.rvAcoesItemDanger : ''].join(' ')}
                            onClick={() => { setAcoesOpen(false); a.onClick(); }}>
                            {a.icon} {a.label}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                <button className={styles.rvAcoesBtn} onClick={() => setAcoesOpen((v) => !v)}>
                  {tr('Opções')} <ChevronDown size={15} className={acoesOpen ? styles.rvAcoesBtnChevronOpen : styles.rvAcoesBtnChevron} />
                </button>
              </div>
            );
          })() : reserva.status === 'orcamento' ? (
            <>
              <button className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} onClick={() => onActivate?.(reserva.id)}>{tr('Ativar Reserva')}</button>
              <button className={[styles.rvBtn, styles.rvBtnDanger, styles.rvBtnSm].join(' ')} onClick={(e) => { setCancelMotivRes(''); setBalao({ tipo: 'cancelar', anchor: e.currentTarget }); }}>{tr('Cancelar')}</button>
            </>
          ) : reserva.status === 'solicitada' ? (
            <>
              <button className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} disabled={saving} onClick={async () => { setSaving(true); try { await onApprove?.(reserva.id, reserva.quarto); onClose(); } finally { setSaving(false); } }}>
                {saving && <Loader2 size={14} className={styles.spin}/>} {tr('Aprovar')}
              </button>
              <button className={[styles.rvBtn, styles.rvBtnDanger, styles.rvBtnSm].join(' ')} disabled={saving} onClick={async () => { setSaving(true); try { await onReject?.(reserva.id); onClose(); } finally { setSaving(false); } }}>
                {tr('Rejeitar')}
              </button>
            </>
          ) : reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' && reserva.status !== 'ausente' ? (
            null
          ) : reserva.status === 'cancelado' ? null : (
            <button className={[styles.rvBtn, styles.rvBtnGold].join(' ')} disabled={voucherLoading} onClick={handleVoucherClick}>
              {voucherLoading ? <><Loader2 size={14} className={styles.spin}/> {tr('Gerando...')}</> : <><FileDown size={14}/> {tr('Voucher')}</>}
            </button>
          )}
        </div>
        )}
      </PainelReserva>
      )}

      {renderBalao()}

      <Modal open={showVoucherScope} onClose={() => setShowVoucherScope(false)} size="sm"
        title={<><FileDown size={14} /> {tr('Gerar Voucher')}</>}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => { setShowVoucherScope(false); requestVoucher(); }}>
              {tr('Apenas esta reserva')}
            </Button>
            <Button variant="primary" style={{ flex: 1 }} onClick={() => { setShowVoucherScope(false); onVoucherGrupo?.(); }}>
              <Users size={14} /> {tr('Grupo')}{groupInfo?.count ? tr(' ({{count}} apt{{v1}})', { count: groupInfo.count, v1: groupInfo.count !== 1 ? 's' : '' }) : ''}
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
          {tr('Esta reserva faz parte de um grupo. Deseja gerar o voucher apenas desta reserva ou do grupo inteiro?')}
        </p>
      </Modal>

      <Modal open={showVoucherChoice} onClose={() => setShowVoucherChoice(false)} size="sm"
        title={<><FileDown size={14} /> {tr('Gerar Voucher')}</>}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => { setShowVoucherChoice(false); handleDownloadVoucher(false); }}>
              {tr('Sem consumos')}
            </Button>
            <Button variant="primary" style={{ flex: 1 }} onClick={() => { setShowVoucherChoice(false); handleDownloadVoucher(true); }}>
              {tr('Com consumos')}
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
          {tr('Esta hospedagem possui consumos registrados. Deseja incluí-los no voucher?')}
        </p>
      </Modal>

      <Modal open={!editing && !!confirmRemovePessoa} onClose={() => setConfirmRemovePessoa(null)} size="sm"
        title={tr('Remover pessoa')}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => setConfirmRemovePessoa(null)}>{tr('Cancelar')}</Button>
            <Button variant="danger" style={{ flex: 1 }} onClick={() => { handleRemovePessoa(confirmRemovePessoa.id); setConfirmRemovePessoa(null); }}>
              {tr('Remover')}
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
          {tr('Tem certeza que deseja remover')} <b>{confirmRemovePessoa?.nome}</b> {tr('desta reserva?')}
        </p>
      </Modal>

      <PaymentModal
        open={!editing && showPayModal}
        onClose={() => setShowPayModal(false)}
        onConfirm={handleAddPagamento}
        tiposPagamento={tiposPagamento}
        isSubmitting={false}
        titularNome={reserva.titularNome}
        lastPayerName={pagamentos.filter(p => !p.cancelado).at(-1)?.nomePagador ?? null}
        canAplicarDesconto={false}
        valorTotal={reserva.valorTotal}
        valorPago={totalPago}
      />

      {inline ? (viewPagamento && (
        <PainelReserva inline acao pag fecharX open onClose={() => setViewPagamento(null)}
          title={<><DollarSign size={15} /> {tr('Detalhes do Pagamento')}</>}>
          <ReciboPagamento p={viewPagamento} />
        </PainelReserva>
      )) : (
      <Modal open={!editing && !!viewPagamento} onClose={() => setViewPagamento(null)} size="sm"
        title={tr('Detalhes do Pagamento')}
        footer={<div className={styles.footerRight}><Button onClick={() => setViewPagamento(null)}>{tr('Fechar')}</Button></div>}
      >
        {viewPagamento && (
          <div className={styles.kvDetailRoot}>

            {/* ── Pagamento ── */}
            <div className={styles.kvSectionDivider}>{tr('Pagamento')}</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Forma de Pagamento')}</span>
                <span className={styles.kvVal}>{viewPagamento.formaPagamento || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Valor')}</span>
                <span className={[styles.kvVal, viewPagamento.cancelado ? styles.pagCardValorCancelado : styles.finPago].join(' ')}>
                  {fmtBRL(viewPagamento.valor)}
                </span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Pagador')}</span>
                <span className={styles.kvVal}>{viewPagamento.nomePagador || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Situação')}</span>
                <span className={viewPagamento.cancelado ? styles.pagCardCanceladoBadge : styles.pagStatusAtivo}>
                  {viewPagamento.cancelado ? tr('Cancelado') : tr('Ativo')}
                </span>
              </div>
              {viewPagamento.descricao && (
                <div className={[styles.kvRow, styles.kvRowFull].join(' ')}>
                  <span className={styles.kvLabel}>{tr('Descrição')}</span>
                  <span className={styles.kvVal}>{viewPagamento.descricao}</span>
                </div>
              )}
            </div>

            {/* ── Registro ── */}
            <div className={styles.kvSectionDivider}>{tr('Registro')}</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Registrado por')}</span>
                <span className={styles.kvVal}>{viewPagamento.funcionario || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{tr('Data')}</span>
                <span className={styles.kvVal}>{viewPagamento.dataRegistro || '—'}</span>
              </div>
            </div>

            {/* ── Cancelamento ── */}
            {viewPagamento.cancelado && (
              <>
                <div className={styles.kvSectionDividerCancel}>{tr('Cancelamento')}</div>
                <div className={styles.kvListCancel}>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>{tr('Cancelado por')}</span>
                    <span className={styles.kvVal}>{viewPagamento.funcMotivo || '—'}</span>
                  </div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>{tr('Data')}</span>
                    <span className={styles.kvVal}>{viewPagamento.dataMotivo || '—'}</span>
                  </div>
                  {viewPagamento.motivoCancelamento && (
                    <div className={[styles.kvRow, styles.kvRowFull].join(' ')}>
                      <span className={styles.kvLabel}>{tr('Motivo')}</span>
                      <span className={styles.kvVal}>{viewPagamento.motivoCancelamento}</span>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </Modal>
      )}

      {/* ── Discard confirmation ── */}
      <Modal open={!editing && showDiscard} onClose={() => setShowDiscard(false)} size="sm"
        title={tr('Descartar alterações?')}
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setShowDiscard(false)}>{tr('Continuar editando')}</Button>
            <Button variant="danger" onClick={handleDiscard}>{tr('Descartar')}</Button>
          </div>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>
          {tr('Há alterações não salvas em pessoas ou pagamentos. Deseja descartá-las?')}
        </p>
      </Modal>

      {/* ── Gerenciar Preços (ajuste manual) ── */}
      {showAdjPreco && (
        adjCalc ? (() => {
          // Diárias gravadas (com id) são a base: o ajuste por diária grava o valor de cada uma.
          // Sem elas (registro antigo), vale o /calcular-preco e só o total é atualizado.
          const gravadas    = (reserva.diarias ?? []).filter((d) => d.id != null);
          const baseDiarias = gravadas.length > 0
            ? gravadas.map((d) => ({ id: d.id, valor: d.valor ?? 0, sazonalidade: d.sazonalidade ?? null }))
            : (adjCalc.detalhes || []).map((d) => ({ valor: d.valor_final ?? 0, sazonalidade: d.sazonalidade?.descricao ?? null }));
          const baseTotal = baseDiarias.length
            ? baseDiarias.reduce((s, d) => s + d.valor, 0)
            : (adjCalc.valor_total ?? 0);
          return (
            <PriceAdjustmentModal
              open
              as={inline ? PainelAcaoReserva : undefined}
              wrapProps={inline ? { naView: true } : undefined}
              botaoAplicar={(aplicar, res, raw) => (
                <BalaoConfirma className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} label={tr('Aplicar')} confirmar={tr('Aplicar')}
                  mensagem={raw.mode === 'diaria' ? (
                    <>{tr('Aplicar o valor de')} <b>{fmtBRL(raw.value)}</b> {raw.selecionadas
                      ? (raw.selecionadas.length === 1
                        ? tr('na diária {{n}}', { n: String(raw.selecionadas[0] + 1).padStart(2, '0') })
                        : tr('nas diárias {{n}}', { n: raw.selecionadas.map((i) => String(i + 1).padStart(2, '0')).join(', ') }))
                      : tr('em todas as diárias')}?</>
                  ) : <>{tr('Aplicar o novo total de')} <b>{fmtBRL(res.valorTotal)}</b>?</>}
                  onConfirm={aplicar} />
              )}
              lateral={inline ? (res, { baseTotal: atual, diff }) => {
                const pend = Math.max(0, res.valorTotal - totalPago);
                return (
                  <aside className={[styles.finResumo, styles.finResumoView].join(' ')}>
                    <div className={styles.finCab}><h4 className={styles.finTit}>{tr('Resumo financeiro')}</h4></div>
                    <div className={styles.finLinha}><span>{tr('Total atual')}</span><b>{fmtBRL(atual)}</b></div>
                    {Math.abs(diff) >= 0.005 && (
                      <div className={styles.finLinha}><span>{diff < 0 ? tr('Desconto') : tr('Adicional')}</span><b>{diff > 0 ? '+' : ''}{fmtBRL(diff)}</b></div>
                    )}
                    <hr className={styles.finSep} />
                    <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Novo total')}</span><b>{fmtBRL(res.valorTotal)}</b></div>
                    {totalPago > 0.005 && (
                      <div className={[styles.finLinha, styles.finPago].join(' ')}><span>{tr('Pago')}</span><b>{fmtBRL(totalPago)}</b></div>
                    )}
                    {res.valorTotal > 0 && totalPago >= res.valorTotal - 0.005 ? (
                      <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
                    ) : pend > 0.005 && (
                      <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(pend)}</b></div>
                    )}
                  </aside>
                );
              } : null}
              onClose={() => setShowAdjPreco(false)}
              baseTotal={baseTotal}
              baseDiarias={baseDiarias}
              onApply={async (result) => {
                if (gravadas.length === 0) {
                  // onUpdate (handleUpdateReserva) já re-sincroniza e notifica.
                  onUpdate(reserva.id, { valor_total: result.valorTotal }).catch(() => {});
                  return;
                }
                try {
                  await hospedagemApi.gerenciarPreco(reserva.id, {
                    ...result.requestFields,
                    valor_total: result.valorTotal,
                    diarias: result.diarias ?? undefined,
                  });
                  onSync?.(normalizeReserva(await hospedagemApi.buscarPorId(reserva.id)));
                  onNotify?.(tr('Preço atualizado.'));
                } catch (e) {
                  onNotify?.(e?.message ?? tr('Erro ao atualizar preço.'), 'error');
                }
              }}
            />
          );
        })() : (
          <PainelReserva inline={inline} acao naView={inline} open onClose={() => setShowAdjPreco(false)} size="sm" title={tr('Gerenciar Preços')}>
            <div style={{ padding: 8 }}>
              <Esqueleto linhas={3} avatar={false} />
            </div>
          </PainelReserva>
        )
      )}
      {editing && inline && renderEdicao()}
    </>
  );
}

// ─── Day Modal ────────────────────────────────────────────────────────────────
function useReservasDoDia(dateStr, refreshKey) {
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateStr) return;
    let vivo = true;
    setLoading(true);
    hospedagemApi.buscar({ status: ['RESERVA_ATIVA', 'PERNOITE_ATIVO', 'PERNOITE_FINALIZADO'], data: toBrDate(dateStr) })
      .then((data) => {
        if (!vivo) return;
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const out = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
        }
        setLista(out.filter((r) => r.dataInicio).sort((a, b) => a.quarto - b.quarto));
      })
      .catch(() => { if (vivo) setLista([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [dateStr, refreshKey]);

  return { lista, loading };
}

function resumoDoDia(lista, categorias) {
  const ocupados = new Set(lista.map((r) => r.quarto));
  const quartos  = categorias.flatMap((c) => c.quartos);
  const livres   = quartos.filter((q) => !ocupados.has(q)).length;
  const pessoas  = lista.reduce((s, r) => s + (r.hospedes?.length || (1 + (r.quantidadeAcompanhantes || 0))), 0);
  return [
    [`${ocupados.size}/${quartos.length}`, tr('Ocupados')],
    [lista.length, lista.length === 1 ? tr('Reserva') : tr('Reservas')],
    [pessoas, pessoas === 1 ? tr('Pessoa') : tr('Pessoas')],
    [livres, livres === 1 ? tr('Livre') : tr('Livres')],
  ];
}

function ResumoDia({ itens, loading, rotulo = null, compacto = false }) {
  return (
    <div className={compacto ? styles.hdrResumo : styles.lstStats}>
      {rotulo && <span className={styles.hdrResumoDia}>{rotulo}</span>}
      {itens.map(([n, rot]) => (
        <div key={rot} className={compacto ? styles.hdrStat : styles.lstStat}>
          {loading ? <span className={[styles.sk, compacto ? '' : styles.skEscuro].join(' ')} style={{ width: compacto ? 22 : 34, height: compacto ? 14 : 18 }} /> : <b>{n}</b>}
          <span>{rot}</span>
        </div>
      ))}
    </div>
  );
}

function ListaDia({ dateStr, lista, loading, onSelectReserva }) {
  if (loading) return <Esqueleto />;
  if (lista.length === 0) return <p className={styles.sideVazio}>{tr('Nenhuma reserva para este dia.')}</p>;

  // Movimentações do dia: saídas (checkout no dia, até 12:00) e chegadas (checkin no dia, após 12:00)
  const secoes = [
    { key: 'saidas',     label: tr('Saídas'),     sub: tr('até 12:00'),          tom: 'Saida',   list: lista.filter((r) => r.dataFim === dateStr) },
    { key: 'chegadas',   label: tr('Chegadas'),   sub: tr('a partir das 12:00'), tom: 'Chegada', list: lista.filter((r) => r.dataInicio === dateStr) },
    { key: 'permanecem', label: tr('Permanecem'), sub: tr('hospedados no dia'),  tom: 'Fica',    list: lista.filter((r) => r.dataInicio !== dateStr && r.dataFim !== dateStr) },
  ].filter((s) => s.list.length > 0);

  return (
    <div className={styles.lstLinha}>
      {secoes.map((sec) => (
        <div key={sec.key} className={[styles.lstSecao, styles[`lstTom${sec.tom}`]].join(' ')}>
          <div className={styles.lstSecaoHead}>
            <span className={[styles.lstDot, styles[`lstDot${sec.tom}`]].join(' ')} />
            <span className={styles.lstSecaoTit}>{sec.label}</span>
            <span className={styles.lstSecaoSub}>{sec.sub}</span>
            <span className={styles.lstQtd}>{sec.list.length}</span>
          </div>
          {sec.list.map((r) => (
            <div key={r.id} className={styles.lstItem}>
              <LinhaReserva r={r} onClick={() => onSelectReserva(r)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Paginação das listas, no mesmo desenho da tela de Cadastros. Página começa em 0.
function Paginacao({ pagina, total, onIr }) {
  return (
    <div className={styles.cadPaginacao}>
      <button type="button" className={styles.cadPageBtn} disabled={pagina === 0} onClick={() => onIr(pagina - 1)}
        aria-label={tr('Página anterior')}>
        <ChevronLeft size={16} />
      </button>
      <span className={styles.cadPageAtual}>{pagina + 1} {tr('de')} {total}</span>
      <button type="button" className={styles.cadPageBtn} disabled={pagina >= total - 1} onClick={() => onIr(pagina + 1)}
        aria-label={tr('Próxima página')}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// Título discreto das listas na box da esquerda, com o voltar em destaque.
function TopoDiscreto({ titulo, sub, onClose }) {
  return (
    <div className={styles.diaTopo}>
      <button type="button" className={styles.diaTopoFechar} onClick={onClose}
        title={tr('Voltar ao calendário')} aria-label={tr('Voltar ao calendário')}>
        <ChevronLeft size={17} />
      </button>
      <span className={styles.diaTopoTxt}>
        <span className={styles.sideGrupoTit}>{titulo}</span>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

function DayModal({ dateStr, lista, loading, onClose, categorias, onSelectReserva }) {
  const naEsquerda = !!useContext(JanelaCtx);
  const dayObj  = new Date(dateStr + 'T00:00:00');
  const weekday = dayObj.toLocaleDateString(locale(), { weekday: 'long' });
  const cap     = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  if (naEsquerda) {
    return (
      <Janela open onClose={onClose} hideHeader>
        <TopoDiscreto titulo={<>{tr('Reservas')} {fmtDateBR(dateStr)}</>} sub={cap} onClose={onClose} />
        <ListaDia dateStr={dateStr} lista={lista} loading={loading} onSelectReserva={onSelectReserva} />
      </Janela>
    );
  }
  return (
    <Janela open onClose={onClose} size="md"
      title={<><CalendarDays size={15} /> {tr('Reservas do dia')}</>}
    >
      <div className={styles.lstDia}>
        <span className={styles.lstDiaData}>{fmtDateBR(dateStr)}</span>
        <span className={styles.lstDiaSemana}>{cap}</span>
      </div>
      <ResumoDia itens={resumoDoDia(lista, categorias)} loading={loading} />
      <ListaDia dateStr={dateStr} lista={lista} loading={loading} onSelectReserva={onSelectReserva} />
    </Janela>
  );
}

// ─── Grupos Modal ─────────────────────────────────────────────────────────────
/** Conteúdo de um grupo — reservas, totais e ações. Abre por cima da listagem,
 *  que continua aberta atrás: fechar aqui volta para a lista. */
// Detalhes de um pagamento, no desenho de recibo da view da reserva.
function ReciboPagamento({ p }) {
  return (
    <div className={styles.pagRecibo}>
      <span className={[styles.pagDetIcone, p.cancelado ? styles.finPgIconOff : ''].join(' ')}>{iconePagamento(p.formaPagamento)}</span>
      <p className={[styles.pagReciboValor, p.cancelado ? styles.pagDetRiscado : ''].join(' ')}>{fmtBRL(p.valor)}</p>
      <span className={[styles.dtStatus, p.cancelado ? styles.dtStatus_cancelado : styles.pagDetAtivo].join(' ')}>
        {p.cancelado ? tr('Cancelado') : tr('Ativo')}
      </span>

      <h5 className={styles.pagDetSecao}>{tr('Pagamento')}</h5>
      <div className={styles.pagReciboLista}>
        <div><span>{tr('Forma')}</span><b>{p.formaPagamento || '—'}</b></div>
        <div><span>{tr('Pagador')}</span><b>{p.nomePagador || '—'}</b></div>
        {p.descricao && <div><span>{tr('Descrição')}</span><b>{p.descricao}</b></div>}
      </div>

      <h5 className={styles.pagDetSecao}>{tr('Registro')}</h5>
      <div className={styles.pagReciboLista}>
        <div><span>{tr('Registrado por')}</span><b>{p.funcionario || '—'}</b></div>
        <div><span>{tr('Data')}</span><b>{p.dataRegistro || '—'}</b></div>
      </div>

      {p.cancelado && (
        <>
          <h5 className={[styles.pagDetSecao, styles.pagDetSecaoCancel].join(' ')}>{tr('Cancelamento')}</h5>
          <div className={styles.pagReciboLista}>
            <div><span>{tr('Cancelado por')}</span><b>{p.funcMotivo || '—'}</b></div>
            <div><span>{tr('Data')}</span><b>{p.dataMotivo || '—'}</b></div>
            {p.motivoCancelamento && <div><span>{tr('Motivo')}</span><b>{p.motivoCancelamento}</b></div>}
          </div>
        </>
      )}
    </div>
  );
}

function GrupoDetalheModal({ grupo, tiposPagamento, onClose, onRenomeado, onSelectReserva, onNovaReservaGrupo, onNotify }) {
  const naDireita = !!useContext(JanelaCtx);
  const dir = useContext(JanelaDirCtx);
  const gid = grupo.grupo_id;
  const [lista,     setLista]     = useState([]);
  const [resumo,    setResumo]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [pagAberto, setPagAberto] = useState(false);
  const [pagVer,    setPagVer]    = useState(null);
  const [salvando,  setSalvando]  = useState(false);
  const [nomeEdit,  setNomeEdit]  = useState(null); // string em edição

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      hospedagemApi.buscarGrupo(gid).catch(() => []),
      hospedagemApi.resumoGrupo(gid).catch(() => null),
    ])
      .then(([membros, res]) => {
        setLista((Array.isArray(membros) ? membros : [])
          .map(normalizeReserva)
          .filter((r) => r.dataInicio)
          .sort((a, b) => a.quarto - b.quarto));
        if (res) setResumo(res);
      })
      .finally(() => setLoading(false));
  }, [gid]);

  useEffect(() => { carregar(); }, [carregar]);

  const registrarPagamento = async (payment) => {
    setSalvando(true);
    try {
      const { _arquivo, _arquivoRemov, _quarto, _despesaInterna, ...limpo } = payment;
      await hospedagemApi.adicionarPagamentoGrupo(gid, limpo);
      onNotify?.(tr('Pagamento registrado no grupo!'));
      setPagAberto(false);
      carregar();
    } catch (e) {
      onNotify?.(e?.message ?? tr('Erro ao registrar o pagamento.'), 'error');
    } finally { setSalvando(false); }
  };

  const salvarNome = async () => {
    const nome = (nomeEdit ?? '').trim();
    setNomeEdit(null);
    try {
      await hospedagemApi.renomearGrupo(gid, nome || null);
      onRenomeado?.(gid, nome || null);
    } catch (e) {
      onNotify?.(e?.message ?? tr('Erro ao renomear o grupo.'), 'error');
    }
  };

  // O mesmo lançamento é vinculado a todas as reservas do grupo, então ele chega
  // repetido nos membros: junta por id. Vale como pagamento do grupo quando o
  // vínculo traz o grupo (fk_grupo) ou quando aparece em mais de uma reserva.
  const pagamentosGrupo = useMemo(() => {
    const vezes = new Map();
    const porId = new Map();
    lista.forEach((r) => (r.pagamentos ?? []).forEach((p) => {
      vezes.set(p.id, (vezes.get(p.id) ?? 0) + 1);
      if (!porId.has(p.id)) porId.set(p.id, p);
    }));
    return [...porId.values()].filter((p) => p.grupoId != null || (vezes.get(p.id) ?? 0) > 1);
  }, [lista]);

  // Grupo de período único: todas as reservas ativas entram e saem no mesmo dia.
  // Nesse caso a nova reserva já abre com essas datas preenchidas.
  const periodoUnico = useMemo(() => {
    const ativas = lista.filter((r) => r.status !== 'cancelado' && r.status !== 'ausente');
    if (ativas.length === 0) return null;
    const { dataInicio, dataFim } = ativas[0];
    if (!dataInicio || !dataFim) return null;
    return ativas.every((r) => r.dataInicio === dataInicio && r.dataFim === dataFim)
      ? { dataInicio, dataFim }
      : null;
  }, [lista]);

  const titulo = grupo.descricao || (grupo.titulares || '').split(',')[0].trim() || `Grupo #${gid}`;
  const qtd    = grupo.count ?? grupo.quantidade ?? lista.length;

  if (dir) {
    const ativas   = lista.filter((r) => r.status !== 'cancelado');
    const inicio   = ativas.reduce((m, r) => (!m || r.dataInicio < m ? r.dataInicio : m), null);
    const fimGrupo = ativas.reduce((m, r) => (!m || r.dataFim > m ? r.dataFim : m), null);
    const nPessoas = ativas.reduce((s, r) => s + (r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0))), 0);
    // Períodos diferentes: o resumo financeiro vem primeiro e as reservas são separadas por período.
    const porPeriodo = !periodoUnico && lista.length > 0
      ? Object.values(lista.reduce((acc, r) => {
          const k = `${r.dataInicio}|${r.dataFim}`;
          (acc[k] ??= { inicio: r.dataInicio, fim: r.dataFim, itens: [] }).itens.push(r);
          return acc;
        }, {})).sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.fim < b.fim ? -1 : 1))
      : null;
    const linhaReserva = (r, comPeriodo) => (
      <tr key={r.id} className={r.status === 'cancelado' ? styles.dtCancelado : ''}>
        <td><span className={styles.dtNum}>{fmtRoom(r.quarto)}</span></td>
        <td className={styles.dtQuebra}><span className={styles.dtCelTit}>{r.titularNome}</span></td>
        {comPeriodo && <td>{fmtDiaMes(r.dataInicio)} → {fmtDiaMes(r.dataFim)}</td>}
        <td className={styles.dtCentro}>{r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0))}</td>
        <td><span className={[styles.dtStatus, styles[`dtStatus_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
        <td className={[styles.dtDir, styles.dtForte].join(' ')}>{fmtBRL(r.valorTotal ?? 0)}</td>
        <td className={styles.dtSetaCel}>
          <button type="button" className={styles.dtSeta} onClick={() => onSelectReserva(r)} title={tr('Ver reserva')} aria-label={tr('Ver reserva')}>
            <ChevronRight size={16} />
          </button>
        </td>
      </tr>
    );
    return (
      <>
        <GavetaDir classe={styles.rvGavetaGrupo} footer={<RodapeOpcoes itens={[
                { label: tr('Pagamento do grupo'), icon: <DollarSign size={15} />, onClick: () => { setPagVer(null); setPagAberto(true); } },
                { label: tr('Nova reserva'), icon: <Plus size={15} />, onClick: () => onNovaReservaGrupo(gid, periodoUnico),
                  title: periodoUnico ? tr('Já abre em {{v0}} → {{v1}}', { v0: fmtDateBR(periodoUnico.dataInicio), v1: fmtDateBR(periodoUnico.dataFim) }) : undefined },
                { label: tr('Responsável'), icon: <Pencil size={15} />, onClick: () => setNomeEdit(grupo.descricao ?? '') },
              ]} />}>
          <div className={styles.rcCard}>
            <CabecalhoGaveta titulo={titulo} chips={[`${qtd} ${tr('apartamento')}${qtd !== 1 ? 's' : ''}`]}
              meta={`${tr('Grupo #')}${gid}`} onClose={onClose} />
            {!porPeriodo && (
              <FaixaPeriodo inicio={inicio} fim={fimGrupo}
                celulas={[[qtd, qtd === 1 ? tr('Apartamento') : tr('Apartamentos')], [nPessoas, nPessoas === 1 ? tr('Pessoa') : tr('Pessoas')]]} />
            )}

            {resumo && (
              <aside className={[styles.finResumo, styles.finResumoView].join(' ')}>
                <div className={styles.finCab}><h4 className={styles.finTit}>{tr('Resumo financeiro')}</h4></div>
                <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Total do grupo')}</span><b>{fmtBRL(resumo.total)}</b></div>
                {resumo.pago > 0.005 && (
                  <div className={[styles.finLinha, styles.finPago].join(' ')}><span>{tr('Pago')}</span><b>{fmtBRL(resumo.pago)}</b></div>
                )}
                {resumo.total > 0 && (() => {
                  const pct = Math.min(100, Math.round(((resumo.pago ?? 0) / resumo.total) * 100));
                  return (
                    <div className={styles.finProg}>
                      <div className={styles.finProgBarra}><span style={{ width: `${pct}%` }} /></div>
                      <div className={styles.finProgLeg}><span>{pct}%</span><span>{tr('Total de {{total}}', { total: fmtBRL(resumo.total) })}</span></div>
                    </div>
                  );
                })()}
                {resumo.pendente > 0.005 ? (
                  <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(resumo.pendente)}</b></div>
                ) : (
                  <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
                )}
              </aside>
            )}

            {loading && lista.length === 0 ? (
              <div className={styles.rcSection}><Esqueleto linhas={4} /></div>
            ) : porPeriodo ? porPeriodo.map((pr, i) => (
              <SecaoTabela key={`${pr.inicio}|${pr.fim}`} temLinhas
                titulo={<span className={styles.grpPeriodo}>
                  <span>{tr('Período')} {i + 1}</span>
                  <b>{fmtDateBR(pr.inicio)} → {fmtDateBR(pr.fim)}</b>
                  <span>{diariasTxt(diffDays(pr.inicio, pr.fim))}</span>
                </span>}
                colunas={[[tr('Apto')], [tr('Titular')], [tr('Pessoas'), 'centro'], [tr('Status')], [tr('Valor'), true], ['']]}>
                {pr.itens.map((r) => linhaReserva(r, false))}
              </SecaoTabela>
            )) : (
              <SecaoTabela titulo={tr('Reservas do grupo')} temLinhas={lista.length > 0} vazio={tr('Nenhuma reserva neste grupo.')}
                colunas={[[tr('Apto')], [tr('Titular')], [tr('Período')], [tr('Pessoas'), 'centro'], [tr('Status')], [tr('Valor'), true], ['']]}>
                {lista.map((r) => linhaReserva(r, true))}
              </SecaoTabela>
            )}

            <SecaoTabela titulo={tr('Pagamentos do grupo')} temLinhas={pagamentosGrupo.length > 0} vazio={tr('Nenhum pagamento registrado.')}
              colunas={[[tr('Forma')], [tr('Data')], [tr('Pagador')], [tr('Valor'), true], ['']]}>
              {pagamentosGrupo.map((p) => (
                <tr key={p.id} className={p.cancelado ? styles.dtCancelado : ''}>
                  <td>
                    <span className={styles.dtForma}>
                      <span className={[styles.finPgIcon, p.cancelado ? styles.finPgIconOff : ''].join(' ')}>{iconePagamento(p.formaPagamento)}</span>
                      <span className={styles.dtCelTit}>{p.formaPagamento || p.descricao || tr('Pagamento')}</span>
                    </span>
                  </td>
                  <td><DataHora valor={p.dataRegistro} /></td>
                  <td className={styles.dtTrunca}>{p.nomePagador || '—'}</td>
                  <td className={[styles.dtDir, styles.dtForte].join(' ')}>{fmtBRL(p.valor)}</td>
                  <td className={styles.dtSetaCel}>
                    <button type="button" className={styles.dtSeta} onClick={() => { setPagAberto(false); setPagVer(p); }} title={tr('Ver detalhes')} aria-label={tr('Ver detalhes')}>
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </SecaoTabela>
          </div>
        </GavetaDir>

        {pagVer && !pagAberto && createPortal(
          <div className={[styles.rvGaveta, styles.rvGavetaAcao, styles.rvGavetaPag, styles.rvGavetaDoGrupo].join(' ')}>
            <header className={styles.janelaHead}>
              <div className={styles.janelaTit}><DollarSign size={15} /> {tr('Detalhes do Pagamento')}</div>
              <button type="button" className={styles.rcCloseBtn} onClick={() => setPagVer(null)} aria-label={tr('Fechar')}>
                <X size={17} />
              </button>
            </header>
            <div className={styles.rvPainelCorpo}><ReciboPagamento p={pagVer} /></div>
          </div>,
          dir,
        )}

        {pagAberto && createPortal(
          <div className={[styles.rvGaveta, styles.rvGavetaAcao, styles.rvGavetaPag, styles.rvGavetaDoGrupo].join(' ')}>
            <header className={styles.janelaHead}>
              <button type="button" className={styles.janelaVoltar} onClick={() => setPagAberto(false)}
                title={tr('Voltar')} aria-label={tr('Voltar')}>
                <ChevronLeft size={17} />
              </button>
              <div className={styles.janelaTit}><DollarSign size={15} /> {tr('Pagamento do grupo')}</div>
            </header>
            <div className={styles.rvPainelCorpo}>
              <PaymentModal inline compacto open onClose={() => setPagAberto(false)} onConfirm={registrarPagamento}
                tiposPagamento={tiposPagamento} isSubmitting={salvando} canAplicarDesconto={false}
                titularNome={lista[0]?.titularNome ?? null} valorTotal={resumo?.total ?? null} valorPago={resumo?.pago ?? null} />
            </div>
          </div>,
          dir,
        )}

      {/* Responsável principal — grupo_reserva.descricao */}
      <Modal open={nomeEdit != null} onClose={() => setNomeEdit(null)} size="sm"
        title={tr('Responsável do grupo')}
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setNomeEdit(null)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={salvarNome}>{tr('Salvar')}</Button>
          </div>
        }
      >
        <FormField label={tr('Nome do responsável')}>
          <Input placeholder={tr('Nome de quem responde pelo grupo')}
            value={nomeEdit ?? ''}
            onChange={(e) => setNomeEdit(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); }} />
        </FormField>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
          {tr('É por este nome que o grupo aparece na lista e ao vincular novas reservas.')}
        </p>
      </Modal>
      </>
    );
  }

  return (
    <>
      <Janela open onClose={onClose} size="lg" hideHeader
        title={<><Users size={15} /> {titulo}<span className={styles.janelaChip}>{qtd} {tr('apartamento')}{qtd !== 1 ? 's' : ''}</span></>}
        footer={naDireita ? null : <div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>{tr('← Voltar')}</Button></div>}
      >
        <div className={styles.rcCard} style={{ marginBottom: 14 }}>
          {!naDireita && <div className={styles.rcHead}>
            <div className={styles.rcHeadLeft}>
              <div className={styles.rcHeadTop}>
                <span className={styles.rcTitle}>{titulo}</span>
                <span className={styles.rcChip}>{qtd} {tr('apartamento')}{qtd !== 1 ? 's' : ''}</span>
              </div>
              <span className={styles.rcHeadMeta}>{tr('Grupo #')}{gid}</span>
            </div>
            <button type="button" className={styles.rcCloseBtn} onClick={onClose} aria-label={tr('Fechar')}>
              <X size={17} />
            </button>
          </div>}

          <div className={styles.rcActions}>
            <button type="button" className={[styles.rcBtn, styles.rcBtnPay].join(' ')}
              onClick={() => setPagAberto(true)}>
              <DollarSign size={14} /> {tr('Pagamento')}
            </button>
            <button type="button" className={styles.rcBtn}
              title={periodoUnico ? tr('Já abre em {{v0}} → {{v1}}', { v0: fmtDateBR(periodoUnico.dataInicio), v1: fmtDateBR(periodoUnico.dataFim) }) : undefined}
              onClick={() => onNovaReservaGrupo(gid, periodoUnico)}>
              <Plus size={14} /> {tr('Nova reserva')}
            </button>
            <button type="button" className={styles.rcBtn}
              title={tr('Renomear o responsável do grupo')}
              onClick={() => setNomeEdit(grupo.descricao ?? '')}>
              <Pencil size={14} /> {tr('Responsável')}
            </button>
          </div>

          <div className={styles.rcSection}>
            {loading && lista.length === 0 ? (
              <Esqueleto linhas={3} />
            ) : lista.length === 0 ? (
              <div className={styles.pagEmpty}>{tr('Nenhuma reserva neste grupo.')}</div>
            ) : (
              <>
                <div className={styles.dayRoomList}>
                  {lista.map((r) => {
                    const dias     = diffDays(r.dataInicio, r.dataFim);
                    const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
                    return (
                      <div key={r.id}
                        className={[styles.dayRoomRow, r.status === 'finalizado' ? styles.dayRoomDone : ''].join(' ')}
                        onClick={() => onSelectReserva(r)}>
                        <div className={[styles.dayRoomBadge, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                        <div className={styles.searchDropInfo}>
                          <div className={styles.searchDropName}>{r.titularNome}</div>
                          <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                          <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} {tr('pessoa')}{nPessoas !== 1 ? 's' : ''}</div>
                        </div>
                        <span className={styles.rcHeadTotal}>{fmtBRL(r.valorTotal ?? 0)}</span>
                      </div>
                    );
                  })}
                </div>

                {pagamentosGrupo.length > 0 && (
                  <>
                    <div className={styles.rcSectionHead}>
                      <span className={styles.rcSectionLabel}>{tr('Pagamentos do grupo')}</span>
                    </div>
                    {pagamentosGrupo.map((p) => (
                      <div key={p.id} className={[styles.step3PagRow, p.cancelado ? styles.rvPayItemCancelado : ''].join(' ')}>
                        <div className={styles.step3PagRowTop}>
                          <span className={styles.step3PagDesc}>{p.descricao || p.formaPagamento || tr('Pagamento')}</span>
                          <span className={p.cancelado ? styles.pagCardValorCancelado : styles.step3PagVal}
                            style={{ marginLeft: 'auto', flexShrink: 0 }}>{fmtBRL(p.valor)}</span>
                        </div>
                        {(p.dataRegistro || p.formaPagamento) && (
                          <div className={styles.step3PagMeta}>{[p.dataRegistro, p.formaPagamento].filter(Boolean).join(' · ')}</div>
                        )}
                        {p.nomePagador && <div className={styles.step3PagMeta}>{p.nomePagador}</div>}
                        {p.funcionario && <div className={styles.step3PagMeta}>{tr('registrado por')} {p.funcionario}</div>}
                        {p.cancelado && <span className={styles.pagCardCanceladoBadge}>{tr('Cancelado')}</span>}
                      </div>
                    ))}
                  </>
                )}

                {resumo && (
                  <div className={styles.rcResumoList}>
                    {resumo.pendente > 0.005 ? (
                      <>
                        <div className={styles.rcResumoRow}>
                          <span>{tr('Total')}</span><span>{fmtBRL(resumo.total)}</span>
                        </div>
                        <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                          <span>{tr('Pago')}</span><span>{fmtBRL(resumo.pago)}</span>
                        </div>
                        <div className={[styles.rcResumoRow, styles.rcResumoDanger].join(' ')}>
                          <span>{tr('Pendente')}</span><span>{fmtBRL(resumo.pendente)}</span>
                        </div>
                      </>
                    ) : (
                      <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                        <span>{tr('Total pago')}</span><span>{fmtBRL(resumo.pago)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Janela>

      {/* Responsável principal — grupo_reserva.descricao */}
      <Modal open={nomeEdit != null} onClose={() => setNomeEdit(null)} size="sm"
        title={tr('Responsável do grupo')}
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setNomeEdit(null)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={salvarNome}>{tr('Salvar')}</Button>
          </div>
        }
      >
        <FormField label={tr('Nome do responsável')}>
          <Input placeholder={tr('Nome de quem responde pelo grupo')}
            value={nomeEdit ?? ''}
            onChange={(e) => setNomeEdit(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); }} />
        </FormField>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
          {tr('É por este nome que o grupo aparece na lista e ao vincular novas reservas.')}
        </p>
      </Modal>

      {/* Pagamento do grupo — um lançamento vinculado a todas as reservas */}
      <PaymentModal
        open={pagAberto}
        onClose={() => setPagAberto(false)}
        onConfirm={registrarPagamento}
        tiposPagamento={tiposPagamento}
        isSubmitting={salvando}
        canAplicarDesconto={false}
        titularNome={lista[0]?.titularNome ?? null}
        valorTotal={resumo?.total ?? null}
        valorPago={resumo?.pago ?? null}
      />
    </>
  );
}

/** Reservas em grupo: lista os grupos em aberto (o back-end esconde os que tiveram
 *  a última reserva finalizada). Abrir um grupo empilha o modal de conteúdo por
 *  cima — esta listagem continua aberta atrás. */
function GruposModal({ onClose, refreshKey, tiposPagamento, onSelectReserva, onNovaReservaGrupo, onNotify, grupoInicial = null }) {
  const naDireita = !!useContext(JanelaCtx);
  const [grupos,  setGrupos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState(grupoInicial != null ? { grupo_id: grupoInicial } : null);

  useEffect(() => {
    setLoading(true);
    hospedagemApi.listarGrupos()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setGrupos(arr);
        setDetalhe((prev) => (prev ? { ...(arr.find((g) => g.grupo_id === prev.grupo_id) ?? {}), ...prev } : prev));
      })
      .catch(() => setGrupos([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const aplicarNome = (gid, nome) => {
    setGrupos((prev) => prev.map((g) => (g.grupo_id === gid ? { ...g, descricao: nome } : g)));
    setDetalhe((prev) => (prev && prev.grupo_id === gid ? { ...prev, descricao: nome } : prev));
  };

  return (
    <>
      <Janela open onClose={onClose} size="lg" hideHeader
        title={<><Users size={15} /> {tr('Reservas em grupo')}{!loading && grupos.length > 0 && <span className={styles.janelaChip}>{grupos.length} {tr('em aberto')}</span>}</>}
        footer={naDireita ? null : <div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>{tr('Fechar')}</Button></div>}
      >
        {!naDireita && <div className={styles.rcCard} style={{ marginBottom: 14 }}>
          <div className={styles.rcHead}>
            <div className={styles.rcHeadLeft}>
              <div className={styles.rcHeadTop}>
                <span className={styles.rcTitle}>{tr('Reservas em grupo')}</span>
                {!loading && grupos.length > 0 && (
                  <span className={styles.rcChip}>{grupos.length} {tr('em aberto')}</span>
                )}
              </div>
            </div>
            <button type="button" className={styles.rcCloseBtn} onClick={onClose} aria-label={tr('Fechar')}>
              <X size={17} />
            </button>
          </div>
        </div>}

        {loading ? (
          <Esqueleto />
        ) : grupos.length === 0 ? (
          <div className={styles.emptyState}>{tr('Nenhum grupo em aberto.')}</div>
        ) : (
          <div className={styles.dayRoomList}>
            {grupos.map((g) => {
              const qtd  = g.count ?? g.quantidade ?? 0;
              const nome = g.descricao || (g.titulares || '').split(',')[0].trim() || `Grupo #${g.grupo_id}`;
              return (
                <div key={g.grupo_id} className={styles.dayRoomRow} onClick={() => setDetalhe(g)}>
                  <div className={styles.searchDropInfo}>
                    <div className={styles.searchDropName}>{nome}</div>
                    <div className={styles.searchDropMeta}>{tr('Grupo #')}{g.grupo_id} · {qtd} {tr('apartamento')}{qtd !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </Janela>

      {detalhe && (
        <GrupoDetalheModal
          grupo={detalhe}
          tiposPagamento={tiposPagamento}
          onClose={() => setDetalhe(null)}
          onRenomeado={aplicarNome}
          onSelectReserva={onSelectReserva}
          onNovaReservaGrupo={onNovaReservaGrupo}
          onNotify={onNotify}
        />
      )}
    </>
  );
}

// ─── Room Modal ───────────────────────────────────────────────────────────────
const ROOM_MES_NOMES = [tr('Janeiro'),tr('Fevereiro'),tr('Março'),tr('Abril'),tr('Maio'),tr('Junho'),tr('Julho'),tr('Agosto'),tr('Setembro'),tr('Outubro'),tr('Novembro'),tr('Dezembro')];

function RoomModal({ room, onClose, categorias, onSelectReserva }) {
  const _hoje = new Date();
  const [modo, setModo]   = useState('mes'); // 'mes' | 'anteriores' | 'proximas'
  const [mes,  setMes]    = useState(_hoje.getMonth() + 1);
  const [ano,  setAno]    = useState(_hoje.getFullYear());
  const [page, setPage]   = useState(0);
  const [res,  setRes]    = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const opts = modo === 'mes' ? { mes, ano, page, size: 8 } : { periodo: modo, page, size: 8 };
    hospedagemApi.buscarPorQuarto(room, opts)
      .then((r) => {
        const content = (r?.content ?? []).map(normalizeReserva).filter((x) => x.dataInicio);
        setRes({ content, totalPages: r?.totalPages ?? 0, totalElements: r?.totalElements ?? 0 });
      })
      .catch(() => setRes({ content: [], totalPages: 0, totalElements: 0 }))
      .finally(() => setLoading(false));
  }, [room, modo, mes, ano, page]); // eslint-disable-line

  const cat = categorias.find((c) => c.quartos.includes(room));
  const changeModo = (m) => { if (m !== modo) { setModo(m); setPage(0); } };
  const shiftMonth = (delta) => {
    let nm = mes + delta, ny = ano;
    if (nm < 1)  { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1;  ny += 1; }
    setMes(nm); setAno(ny); setPage(0);
  };

  const FILTROS = [['mes', tr('Por mês')], ['anteriores', tr('Anteriores')], ['proximas', tr('Próximas')]];

  const naEsquerda = !!useContext(JanelaCtx);

  return (
    <Janela open onClose={onClose} size="md" hideHeader={naEsquerda}
      title={naEsquerda ? null : <><BedDouble size={15} /> {tr('Apartamento')} {fmtRoom(room)}{cat?.nome && <span className={styles.janelaChip}>{cat.nome}</span>}</>}
      footer={null}
    >
      {naEsquerda && <TopoDiscreto titulo={<>{tr('Apartamento')} {fmtRoom(room)}</>} sub={cat?.nome} onClose={onClose} />}
      <div className={styles.lstSeg} role="tablist">
        {FILTROS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id}
            className={[styles.lstSegBtn, modo === id ? styles.lstSegBtnOn : ''].join(' ')}
            onClick={() => changeModo(id)}>
            {label}
          </button>
        ))}
      </div>

      {modo === 'mes' && (
        <div className={styles.lstMes}>
          <button type="button" className={styles.lstMesBtn} onClick={() => shiftMonth(-1)} title={tr('Mês anterior')} aria-label={tr('Mês anterior')}><ChevronLeft size={15} /></button>
          <span className={styles.lstMesNome}>{ROOM_MES_NOMES[mes - 1]} {ano}</span>
          <button type="button" className={styles.lstMesBtn} onClick={() => shiftMonth(1)} title={tr('Próximo mês')} aria-label={tr('Próximo mês')}><ChevronRight size={15} /></button>
        </div>
      )}

      {loading ? (
        <Esqueleto />
      ) : (
        <>
          <p className={styles.lstResumo}>
            <b>{res.totalElements}</b> {res.totalElements === 1 ? tr('reserva') : tr('reservas')}{' '}
            {modo === 'mes' ? tr('em {{mes}}', { mes: ROOM_MES_NOMES[mes - 1] }) : modo === 'anteriores' ? tr('anteriores') : tr('próximas')}
          </p>
          {res.content.length === 0 ? (
            <p className={styles.sideVazio}>
              {modo === 'mes' ? tr('Nenhuma reserva neste mês.') : modo === 'anteriores' ? tr('Nenhuma reserva anterior.') : tr('Nenhuma reserva futura.')}
            </p>
          ) : (
            <div className={[styles.lstLinha, styles.lstLinhaSoItens].join(' ')}>
              <div className={[styles.lstSecao, styles.lstTomFica].join(' ')}>
                {res.content.map((r) => (
                  <div key={r.id} className={styles.lstItem}>
                    <LinhaReserva r={r} mostrarQuarto={false} onClick={() => onSelectReserva(r)} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {res.totalPages > 1 && <Paginacao pagina={page} total={res.totalPages} onIr={setPage} />}
        </>
      )}
    </Janela>
  );
}

// ─── Status Filter Modal ──────────────────────────────────────────────────────
const STATUS_FILTER_OPTIONS = [
  ['confirmada',          tr('Reserva Ativa')],
  ['hospedado',           tr('Hospedado')],
  ['finalizado',          tr('Finalizado')],
  ['cancelado',           tr('Cancelada')],
  ['ausente',             tr('Ausente')],
  ['pernoite_cancelado',  tr('Pernoite Cancelado')],
  ['pagamento_pendente',  tr('Pagamento Pendente')],
];
const STATUS_PAGE_SIZE = 10;

function StatusFilterModal({ status, label, onClose, onSelectReserva }) {
  const [page,    setPage]    = useState(1);
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);

  const API_STATUS = {
    confirmada:         'RESERVA_ATIVA',
    hospedado:          'PERNOITE_ATIVO',
    finalizado:         'PERNOITE_FINALIZADO',
    cancelado:          'RESERVA_CANCELADA',
    ausente:            'RESERVA_AUSENTE',
    pernoite_cancelado: 'PERNOITE_CANCELADO',
    pagamento_pendente: 'PERNOITE_FINALIZADO_PAGAMENTO_PENDENTE',
  };
  useEffect(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: API_STATUS[status] ?? status.toUpperCase() })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const deduped = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); deduped.push(normalizeReserva(r)); }
        }
        setList(deduped.filter((r) => r.dataInicio));
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [status]);

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / STATUS_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = list.slice((safePage - 1) * STATUS_PAGE_SIZE, safePage * STATUS_PAGE_SIZE);

  const naEsquerda = !!useContext(JanelaCtx);
  const paginacao = !loading && pages > 1 && (
    <Paginacao pagina={safePage - 1} total={pages} onIr={(p) => setPage(p + 1)} />
  );

  return (
    <Janela open onClose={onClose} size="md" hideHeader={naEsquerda}
      bodyStyle={naEsquerda ? undefined : { flexShrink: 0, flexGrow: 0, flexBasis: 'clamp(200px, 48vh, 360px)' }}
      title={naEsquerda ? null : <><span className={[styles.statusDot, styles[`status_${status}`]].join(' ')} style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />{label}{!loading && ` (${total})`}</>}
      footer={naEsquerda ? null : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{loading ? <span className={styles.sk} style={{ width: 80, display: 'inline-block' }} /> : `${total} reserva${total !== 1 ? 's' : ''}`}</span>
          {paginacao}
        </div>
      )}
    >
      {naEsquerda && (
        <TopoDiscreto titulo={label}
          sub={loading ? '…' : `${total} ${total === 1 ? tr('reserva') : tr('reservas')}`} onClose={onClose} />
      )}
      {loading ? (
        <Esqueleto linhas={6} />
      ) : total === 0 ? (
        <p className={styles.sideVazio}>{tr('Nenhuma reserva com status "{{label}}".', { label })}</p>
      ) : (
        <div className={[styles.lstLinha, styles.lstLinhaSoItens].join(' ')}>
          <div className={[styles.lstSecao, styles[`lstTomSt_${status}`]].join(' ')}>
            {slice.map((r) => (
              <div key={r.id} className={styles.lstItem}>
                <LinhaReserva r={r} onClick={() => { onSelectReserva(r); if (!naEsquerda) onClose(); }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {naEsquerda && paginacao}
    </Janela>
  );
}

// ─── Orçamento Detail Modal ───────────────────────────────────────────────────
function OrcamentoDetailModal({ orcamentoId, onClose, onSelectReserva, roomDescMap }) {
  const [orc,      setOrc]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [priceOpen, setPriceOpen] = useState({});

  useEffect(() => {
    orcamentoApi.buscar({ orcamentoId })
      .then((data) => {
        // GET /orcamento/buscar retorna array
        const item = Array.isArray(data) ? data[0] : data;
        setOrc(item ?? null);
      })
      .catch(() => setOrc(null))
      .finally(() => setLoading(false));
  }, [orcamentoId]);

  // Suporte a `hospedagens` (novo) e `reservas` (legado)
  const reservas = useMemo(() => {
    const list = orc?.hospedagens ?? orc?.reservas ?? [];
    return list.map((h) => normalizeReserva({
      ...h,
      orcamento_info: {
        id:               orc?.id,
        nome_solicitante: orc?.nome_solicitante,
        data_hora_registro: orc?.data_hora_registro,
      },
    })).filter((r) => r.dataInicio);
  }, [orc]);
  const grandTotal = reservas.reduce((s, r) => s + (r.valorTotal ?? 0), 0);
  const totalPago  = reservas.reduce((s, r) => s + (r.totalPago  ?? 0), 0);
  const pendente   = Math.max(0, grandTotal - totalPago);

  const handleDownload = () => {
    // Group reservas by period (same checkin+checkout)
    const periodMap = new Map();
    reservas.forEach((r) => {
      const key = `${r.dataInicio}_${r.dataFim}`;
      if (!periodMap.has(key)) periodMap.set(key, { checkin: r.dataInicio, checkout: r.dataFim, rooms: [], roomHospedes: {} });
      const p = periodMap.get(key);
      p.rooms.push(String(r.quarto));
      p.roomHospedes[String(r.quarto)] = r.hospedes?.length > 0 ? r.hospedes : (r.pessoasOrcamento ?? []);
    });
    const displayPeriodos = [...periodMap.values()];
    const periodoMode = displayPeriodos.length > 1 ? 'multiplos' : 'unico';

    const precosCalc = {};
    const quartosObs = {};
    displayPeriodos.forEach((p, pi) => {
      p.rooms.forEach((quartoId) => {
        const r = reservas.find((rv) => String(rv.quarto) === quartoId && rv.dataInicio === p.checkin && rv.dataFim === p.checkout);
        precosCalc[`${quartoId}_${pi}`] = { valor_total: r?.valorTotal ?? 0, detalhes: [], sazonalidades_aplicadas: [] };
        if (r?.observacao) quartosObs[`${quartoId}_${pi}`] = r.observacao;
      });
    });
    const _u = userStorage.get();
    const titular = reservas[0]?.hospedes?.[0] ?? reservas[0]?.pessoasOrcamento?.[0] ?? null;
    const solicitanteData = {
      nome:           orc?.nome_solicitante ?? titular?.nome ?? '',
      cpf:            titular?.cpf ?? '',
      telefone:       titular?.telefone ?? '',
      email:          titular?.email ?? '',
      dataNascimento: titular?.dataNascimento ?? '',
      dataRegistro:   orc?.data_hora_registro ?? '',
    };
    gerarVoucherReserva({ tipo: 'grupo', periodoMode, displayPeriodos, precosCalc, quartosObs, roomDescMap, userName: _u?.pessoa?.nome ?? _u?.nome ?? '', solicitante: solicitanteData });
  };

  const solicitante   = orc?.nome_solicitante ?? '';
  const dataRegistro  = orc?.data_hora_registro ?? '';

  return (
    <Janela open onClose={onClose} size="md"
      title={<><FileText size={15} /> {tr('Orçamento')} {solicitante ? `— ${solicitante}` : ''}</>}
      footer={
        <div className={styles.footerSpread}>
          <Button variant="secondary" onClick={onClose}>{tr('← Voltar')}</Button>
          <button className={styles.orcDownloadBtn} onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', width: 'auto' }}>
            <FileDown size={15} /> <span style={{ fontSize: 12 }}>{tr('Baixar PDF')}</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <Esqueleto linhas={5} avatar={false} />
      ) : !orc ? (
        <div className={styles.emptyState}>{tr('Não foi possível carregar o orçamento.')}</div>
      ) : (
        <div className={styles.step3Root} style={{ padding: '14px 16px' }}>

          {/* ── Financial summary strip ── */}
          <div className={styles.priceCard} style={{ marginBottom: 14 }}>
            <div className={styles.priceCardHeader} style={{ cursor: 'default' }}>
              <span className={styles.priceCardSummary}>
                <span className={styles.finStripItem}>{tr('Valor Total')} <b>{fmtBRL(grandTotal)}</b></span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>{tr('Pago')} <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(totalPago / grandTotal * 100)}%)</span>}</span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>{tr('Pendente')} <b style={{ color: pendente > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(pendente)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(pendente / grandTotal * 100)}%)</span>}</span>
              </span>
            </div>
          </div>

          {/* ── Reservas grouped by period ── */}
          {(() => {
            // Group by period key
            const periodMap = new Map();
            reservas.forEach((r) => {
              const key = `${r.dataInicio}_${r.dataFim}`;
              if (!periodMap.has(key)) periodMap.set(key, { dataInicio: r.dataInicio, dataFim: r.dataFim, reservas: [] });
              periodMap.get(key).reservas.push(r);
            });
            const periods = [...periodMap.values()];
            const multiPeriod = periods.length > 1;

            return periods.map((period) => {
              const pDias = diffDays(period.dataInicio, period.dataFim);
              return (
                <div key={`${period.dataInicio}_${period.dataFim}`}>
                  {/* Period band — only when multiple periods */}
                  {multiPeriod && (
                    <div className={styles.step3PeriodoBand} style={{ marginBottom: 0 }}>
                      <span className={styles.step3PeriodoBandDates}>{fmtDateBR(period.dataInicio)} → {fmtDateBR(period.dataFim)} · {diariasTxt(pDias)}</span>
                    </div>
                  )}

                  {period.reservas.map((r) => {
                    const dias     = diffDays(r.dataInicio, r.dataFim);
                    const hospedes = r.pessoasOrcamento?.length > 0 ? r.pessoasOrcamento : (r.hospedes ?? []);
                    const isOpen   = !!priceOpen[r.id];
                    const valorDiaria = dias > 0 ? r.valorTotal / dias : 0;
                    return (
                      <div key={r.id} className={styles.orcRoomCard}>
                        {/* Room label */}
                        <div className={styles.orcRoomCardLabel}>
                          {tr('Apartamento')} {fmtRoom(r.quarto)}
                          {!multiPeriod && <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12, marginLeft: 8 }}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)} · {diariasTxt(dias)}</span>}
                        </div>

                        <div className={styles.orcRoomCardBody}>
                          {/* Hóspedes */}
                          {hospedes.length > 0 && (
                            <div className={styles.orcHospedeList} style={{ marginTop: 0 }}>
                              {hospedes.map((h, hi) => {
                                const age = calcAge(h.dataNascimento);
                                return (
                                  <div key={h.id ?? hi} className={styles.orcHospedeRow}>
                                    <div className={styles.initialsCircleSm}>{initials(h.nome)}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{h.nome}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                                        {age !== null ? `${age} anos` : ''}
                                        {h.dataNascimento ? ` · ${h.dataNascimento}` : ''}
                                      </div>
                                    </div>
                                    {hi === 0 && <span className={styles.titularBadge} style={{ flexShrink: 0 }}>{tr('Titular')}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Price breakdown */}
                          {r.valorTotal > 0 && (
                            <div className={styles.step3PriceBlock}>
                              {dias > 0 && Array.from({ length: dias }).map((_, di) => {
                                const from = addDays(r.dataInicio, di);
                                const to   = addDays(r.dataInicio, di + 1);
                                return (
                                  <div key={di} className={styles.step3PriceRow}>
                                    <span className={styles.step3PriceDesc}>{tr('Diária')} {di + 1} &nbsp;{fmtDateBR(from)} → {fmtDateBR(to)}</span>
                                    <span className={styles.step3PriceVal}>{fmtBRL(valorDiaria)}</span>
                                  </div>
                                );
                              })}
                              <div className={styles.step3PriceTotal}>
                                <span>{tr('Total')}</span>
                                <span>{fmtBRL(r.valorTotal)}</span>
                              </div>
                            </div>
                          )}

                          {r.observacao && (
                            <div style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>{r.observacao}</div>
                          )}

                          <div style={{ textAlign: 'right' }}>
                            <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => onSelectReserva(r)}>
                              {tr('Ver reserva →')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}

          {dataRegistro && (
            <div className={styles.dadosRegistrado}>
              <span className={styles.kvLabel}>{tr('Solicitado em')}</span>
              <span className={styles.kvVal}>{dataRegistro}</span>
            </div>
          )}
        </div>
      )}
    </Janela>
  );
}

// ─── Orçamentos Modal ─────────────────────────────────────────────────────────
function OrcamentosModal({ onClose, categorias = [], tiposPagamento = [], reservas = [], roomDescMap = {}, onSave, onSelectReserva }) {
  const [search,      setSearch]      = useState('');
  const [orcamentos,  setOrcamentos]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(new Set()); // Set de IDs expandidos
  const [editOrc,     setEditOrc]     = useState(null);      // orçamento sendo editado
  const [editNome,    setEditNome]    = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const [showCreate,    setShowCreate]    = useState(false); // abre CreateModal como Novo Orçamento
  const [cancelOrc,     setCancelOrc]     = useState(null);  // orçamento a cancelar
  const [cancelAnchor,  setCancelAnchor]  = useState(null);  // com âncora: confirma no balão
  const [cancelMotivo,  setCancelMotivo]  = useState('');
  const [cancelSaving,  setCancelSaving]  = useState(false);
  const [openMenuId,    setOpenMenuId]    = useState(null);  // id do orçamento com menu aberto
  const [approveSaving, setApproveSaving] = useState(false);
  const [orcAberto,     setOrcAberto]     = useState(null);
  const dirOrc = useContext(JanelaDirCtx);
  const timerRef  = useRef(null);
  const menuRef   = useRef(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const h = (e) => { if (!menuRef.current?.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchOrcamentos = useCallback((nome = '') => {
    setLoading(true);
    const params = nome.trim() ? { nomeSolicitante: nome.trim() } : {};
    orcamentoApi.buscar(params)
      .then((data) => setOrcamentos(Array.isArray(data) ? data : []))
      .catch(() => setOrcamentos([]))
      .finally(() => setLoading(false));
  }, []);

  // Busca inicial
  useEffect(() => { fetchOrcamentos(); }, []); // eslint-disable-line

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchOrcamentos(val), 400);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Editar nome do orçamento ───────────────────────────────────────────────
  const openEditOrc = (e, orc) => {
    e.stopPropagation();
    setEditOrc(orc);
    setEditNome(orc.nome_solicitante ?? '');
  };

  const handleSaveEditNome = async () => {
    if (!editOrc || !editNome.trim()) return;
    setEditSaving(true);
    try {
      await orcamentoApi.editar({ id: editOrc.id, nome_solicitante: editNome.trim() });
      setOrcamentos((prev) => prev.map((o) =>
        o.id === editOrc.id ? { ...o, nome_solicitante: editNome.trim() } : o
      ));
      setEditOrc(null);
    } catch { /* silencia */ } finally {
      setEditSaving(false);
    }
  };

  // ── Gerar voucher do orçamento ─────────────────────────────────────────────
  const handleVoucher = (e, orc) => {
    e.stopPropagation();
    const _u = userStorage.get();
    const hospedagens = orc.hospedagens ?? [];
    const displayPeriodos = hospedagens.map((h) => {
      const checkin  = parseBrDate(h.data_hora_checkin);
      const checkout = parseBrDate(h.data_hora_checkout);
      const roomId   = String(h.quarto_id ?? h.quarto?.id ?? '');
      const pessoas  = (h.pessoas_orcamento ?? []).map((p) => ({ id: p.id, nome: p.nome }));
      return { checkin, checkout, rooms: [roomId], roomHospedes: { [roomId]: pessoas } };
    });
    const precosCalc = {};
    hospedagens.forEach((h, i) => {
      const roomId = String(h.quarto_id ?? h.quarto?.id ?? '');
      precosCalc[`${roomId}_${i}`] = { valor_total: h.valor_total ?? 0, detalhes: [], sazonalidades_aplicadas: [] };
    });
    gerarVoucherReserva({
      tipo: 'individual', periodoMode: 'unico',
      displayPeriodos, precosCalc, quartosObs: {}, roomDescMap: {},
      userName: _u?.pessoa?.nome ?? _u?.nome ?? '',
      solicitante: { nome: orc.nome_solicitante ?? '', cpf: '' },
      pagamentos: [],
      isOrcamento: true,
    });
  };

  // ── Aprovar orçamento ─────────────────────────────────────────────────────
  const handleApprove = async (orc) => {
    setOpenMenuId(null);
    setApproveSaving(true);
    try {
      await orcamentoApi.aprovar(orc.id);
      fetchOrcamentos(search);
    } catch { /* silencia */ } finally {
      setApproveSaving(false);
    }
  };

  // Hospedagem do orçamento abre na view da reserva — só quando já tem pessoa.
  const verHosp = (orc, h) => {
    if (!onSelectReserva || !(h.pessoas_orcamento ?? []).length) return;
    onSelectReserva(reservas.find((r) => r.id === h.id)
      ?? normalizeReserva({ ...h, orcamento_info: { id: orc.id, nome_solicitante: orc.nome_solicitante } }));
  };

  // ── Cancelar orçamento ────────────────────────────────────────────────────
  const openCancelOrc = (e, orc, anchor = null) => {
    e.stopPropagation();
    setCancelOrc(orc);
    setCancelAnchor(anchor);
    setCancelMotivo('');
  };
  const fecharCancelOrc = () => { setCancelOrc(null); setCancelAnchor(null); setCancelMotivo(''); };

  const handleConfirmCancel = async () => {
    if (!cancelOrc || !cancelMotivo.trim()) return;
    setCancelSaving(true);
    try {
      await orcamentoApi.cancelar(cancelOrc.id, cancelMotivo.trim());
      // Atualiza status localmente — o backend não deleta, só muda para ORCAMENTO_CANCELADO
      setOrcamentos((prev) => prev.map((o) =>
        o.id === cancelOrc.id ? { ...o, status: 'ORCAMENTO_CANCELADO' } : o
      ));
      fecharCancelOrc();
    } catch { /* silencia */ } finally {
      setCancelSaving(false);
    }
  };

  return (
    <>
    {/* CreateModal como Novo Orçamento — renderizado sobre o modal de lista */}
    {showCreate && (
      <CreateModal
        forceOrcamento
        reservas={reservas}
        categorias={categorias}
        tiposPagamento={tiposPagamento}
        roomDescMap={roomDescMap}
        onClose={() => setShowCreate(false)}
        onSave={async (result) => {
          setShowCreate(false);
          fetchOrcamentos(search); // atualiza a lista após criar
          onSave?.(result);
        }}
        onNotify={() => {}}
      />
    )}

    <Janela open={!showCreate || !!dirOrc} onClose={onClose} size="md"
      title={<><FileText size={15} /> {tr('Orçamentos')}{!loading && orcamentos.length > 0 && <span className={styles.janelaChip}>{orcamentos.length} {orcamentos.length === 1 ? tr('orçamento') : tr('orçamentos')}</span>}</>}
      acaoTopo={
        <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary, styles.btnTopo].join(' ')} onClick={() => setShowCreate(true)}>
          <Plus size={14} /> {tr('Novo')}
        </Button>
      }
    >
      {loading ? (
        <Esqueleto />
      ) : orcamentos.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? tr('Nenhum orçamento encontrado para "{{search}}".', { search }) : tr('Nenhum orçamento cadastrado.')}
        </div>
      ) : dirOrc ? (
        <div className={styles.dayRoomList}>
          {orcamentos.map((orc) => {
            const hospedagens = orc.hospedagens ?? [];
            const grandTotal  = hospedagens.reduce((s, h) => s + (h.valor_total ?? 0), 0);
            const isCancelado = (orc.status != null
              ? (orc.status + '').toUpperCase() === 'ORCAMENTO_CANCELADO'
              : hospedagens.length > 0 && hospedagens.every((h) => mapStatus(h) === 'cancelado'));
            const todayISO  = formatDate(new Date());
            const isExpired = !isCancelado && hospedagens.length > 0 && hospedagens.some((h) => {
              const co = parseBrDate(h.data_hora_checkout);
              return co && co < todayISO;
            });
            return (
              <div key={orc.id} className={[styles.dayRoomRow, orcAberto === orc.id ? styles.dayRoomRowAtivo : '', isCancelado ? styles.orcListGroupCancelado : ''].join(' ')}
                onClick={() => setOrcAberto(orcAberto === orc.id ? null : orc.id)}>
                <div className={styles.searchDropInfo}>
                  <div className={styles.searchDropName}>
                    {orc.nome_solicitante}
                    {isCancelado && <span className={[styles.orcStatusPill, styles.orcStatusPillCancelado].join(' ')}>{tr('Cancelado')}</span>}
                    {isExpired && <span className={[styles.orcStatusPill, styles.orcStatusPillVencido].join(' ')}>{tr('Vencido')}</span>}
                  </div>
                  <div className={styles.searchDropMeta}>
                    {orc.data_hora_registro}
                    {hospedagens.length > 0 && <> · {hospedagens.length} {tr('hospedagem')}{hospedagens.length !== 1 ? 's' : ''}</>}
                    {grandTotal > 0 && <> · {fmtBRL(grandTotal)}</>}
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.orcListRoot}>
          {orcamentos.map((orc) => {
            const isOpen      = expanded.has(orc.id);
            const hospedagens = orc.hospedagens ?? [];
            const grandTotal  = hospedagens.reduce((s, h) => s + (h.valor_total ?? 0), 0);

            // Cancelado: status explícito no orçamento OU todas as hospedagens canceladas
            const isCancelado = (orc.status != null
              ? (orc.status + '').toUpperCase() === 'ORCAMENTO_CANCELADO'
              : hospedagens.length > 0 && hospedagens.every((h) => mapStatus(h) === 'cancelado'));

            // Vencido: alguma hospedagem com checkout anterior a hoje — não pode ser aprovado
            const todayISO = formatDate(new Date());
            const isExpired = !isCancelado && hospedagens.length > 0 && hospedagens.some((h) => {
              const co = parseBrDate(h.data_hora_checkout);
              return co && co < todayISO;
            });

            return (
              <div key={orc.id} className={[
                styles.orcListGroup,
                isCancelado ? styles.orcListGroupCancelado : '',
                isExpired ? styles.orcListGroupExpired : '',
              ].join(' ')}>

                {/* ── Linha cabeçalho ── */}
                <div className={styles.orcListRowWrap}>
                  <button className={[styles.orcListRow, dirOrc && orcAberto === orc.id ? styles.orcListRowAtivo : ''].join(' ')}
                    onClick={() => (dirOrc ? setOrcAberto(orcAberto === orc.id ? null : orc.id) : toggleExpand(orc.id))}>
                    <div className={styles.orcListInfo}>
                      <span className={styles.orcListNameRow}>
                        <span className={styles.orcListName}>{orc.nome_solicitante}</span>
                        {isCancelado && <span className={[styles.orcStatusPill, styles.orcStatusPillCancelado].join(' ')}>{tr('Cancelado')}</span>}
                        {isExpired && <span className={[styles.orcStatusPill, styles.orcStatusPillVencido].join(' ')}>{tr('Vencido')}</span>}
                      </span>
                      <span className={styles.orcListMeta}>
                        {orc.data_hora_registro}
                        {hospedagens.length > 0 && (
                          <> · <b>{hospedagens.length}</b> {tr('hospedagem')}{hospedagens.length !== 1 ? 's' : ''}</>
                        )}
                        {grandTotal > 0 && <> · {fmtBRL(grandTotal)}</>}
                      </span>
                    </div>
                    {dirOrc ? <ChevronRight size={15} style={{ flexShrink: 0, color: 'var(--text-2)' }} /> : <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-2)', transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : '' }} />}
                  </button>

                  {/* FAB de ações — oculto quando cancelado */}
                  {!isCancelado && (
                    <div
                      className={styles.orcMenuWrap}
                      ref={openMenuId === orc.id ? menuRef : null}
                    >
                      <button
                        className={[styles.orcMenuTrigger, openMenuId === orc.id ? styles.orcMenuTriggerActive : ''].join(' ')}
                        title={tr('Ações')}
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === orc.id ? null : orc.id); }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openMenuId === orc.id && (
                        <div className={styles.orcMenuDrop}>
                          <button className={styles.orcMenuItem} onClick={(e) => { setOpenMenuId(null); openEditOrc(e, orc); }}>
                            <Pencil size={12} /> {tr('Editar')}
                          </button>
                          <button className={styles.orcMenuItem} onClick={(e) => { setOpenMenuId(null); handleVoucher(e, orc); }}>
                            <FileDown size={12} /> {tr('Gerar PDF')}
                          </button>
                          <button
                            className={[styles.orcMenuItem, styles.orcMenuItemApprove].join(' ')}
                            disabled={approveSaving || isExpired}
                            title={isExpired ? tr('Orçamento vencido: o check-out já passou e não pode ser aprovado.') : undefined}
                            onClick={() => handleApprove(orc)}>
                            <Check size={12} /> {isExpired ? tr('Vencido — não aprovável') : tr('Aprovar Orçamento')}
                          </button>
                          <div className={styles.orcMenuDivider} />
                          <button className={[styles.orcMenuItem, styles.orcMenuItemDanger].join(' ')} onClick={(e) => { setOpenMenuId(null); openCancelOrc(e, orc); }}>
                            <Trash2 size={12} /> {tr('Cancelar')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Hospedagens expandidas ── */}
                {isOpen && (
                  <div className={styles.orcHospList}>
                    {hospedagens.map((h) => {
                      const st       = mapStatus(h);
                      const pessoas  = h.pessoas_orcamento ?? [];
                      const checkin  = parseBrDate(h.data_hora_checkin);
                      const checkout = parseBrDate(h.data_hora_checkout);
                      const dias     = checkin && checkout ? diffDays(checkin, checkout) : 0;
                      const motivo   = h.motivo_cancelamento?.motivo_cancelamento ?? null;
                      const quartoId = h.quarto_id ?? h.quarto?.id ?? null;

                      return (
                        <div
                          key={h.id}
                          className={[styles.orcHospItem, st === 'cancelado' ? styles.orcHospItemCancelado : ''].join(' ')}
                          onClick={() => verHosp(orc, h)}
                          style={(h.pessoas_orcamento ?? []).length ? undefined : { cursor: 'default' }}
                        >
                          {/* ── Banda de período escura ── */}
                          <div className={styles.orcHospBand}>
                            <span className={styles.orcHospBandPeriod}>
                              {fmtDateBR(checkin)} → {fmtDateBR(checkout)}
                            </span>
                            <span className={styles.orcHospBandDiarias}>{diariasTxt(dias)}</span>
                          </div>

                          {/* Quarto */}
                          {quartoId && (
                            <div className={styles.orcHospRoomLabel}>
                              {tr('Apartamento')} {fmtRoom(quartoId)}
                            </div>
                          )}

                          {/* Pessoas — lista vertical sem chips */}
                          {pessoas.length > 0 && (
                            <div className={styles.orcHospPessoasList}>
                              {pessoas.map((p) => {
                                const age = calcAge(p.data_nascimento);
                                return (
                                  <div key={p.id} className={styles.orcHospPessoaRow}>
                                    <span className={styles.orcHospPessoaNome}>{p.nome}</span>
                                    {age !== null && <span className={styles.orcHospPessoaAge}>{age} {tr('anos')}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Valor total */}
                          {h.valor_total > 0 && (
                            <div className={styles.orcHospFooter}>
                              <span className={styles.orcHospValor}>{tr('Total:')} {fmtBRL(h.valor_total)}</span>
                            </div>
                          )}

                          {/* Observação */}
                          {h.observacao && (
                            <div className={styles.orcHospObs}>{h.observacao}</div>
                          )}

                          {/* Motivo cancelamento */}
                          {motivo && (
                            <div className={styles.orcHospCancelReason}>
                              <XCircle size={11} style={{ flexShrink: 0 }} />
                              {motivo}
                              {h.motivo_cancelamento?.data_hora_registro && (
                                <span style={{ color: 'var(--text-2)', marginLeft: 4 }}>
                                  · {h.motivo_cancelamento.data_hora_registro}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Janela>

    {/* ── Orçamento aberto: conteúdo na direita ── */}
    {dirOrc && (() => {
      const orc = orcamentos.find((o) => o.id === orcAberto);
      if (!orc) return null;
      const hospedagens = orc.hospedagens ?? [];
      const grandTotal  = hospedagens.reduce((s, h) => s + (h.valor_total ?? 0), 0);
      const isCancelado = (orc.status != null
        ? (orc.status + '').toUpperCase() === 'ORCAMENTO_CANCELADO'
        : hospedagens.length > 0 && hospedagens.every((h) => mapStatus(h) === 'cancelado'));
      const todayISO  = formatDate(new Date());
      const isExpired = !isCancelado && hospedagens.some((h) => { const co = parseBrDate(h.data_hora_checkout); return co && co < todayISO; });
      const inicios   = hospedagens.map((h) => parseBrDate(h.data_hora_checkin)).filter(Boolean).sort();
      const fins      = hospedagens.map((h) => parseBrDate(h.data_hora_checkout)).filter(Boolean).sort();
      const nPessoas  = hospedagens.reduce((s, h) => s + (h.pessoas_orcamento ?? []).length, 0);
      const ev = { stopPropagation() {} };
      return (
        <GavetaDir classe={styles.rvGavetaComRodape} footer={isCancelado ? null : <RodapeOpcoes itens={[
          { label: tr('Editar'), icon: <Pencil size={15} />, onClick: () => openEditOrc(ev, orc) },
          { label: tr('Gerar PDF'), icon: <FileDown size={15} />, onClick: () => handleVoucher(ev, orc) },
          { label: isExpired ? tr('Vencido — não aprovável') : tr('Aprovar Orçamento'), icon: <Check size={15} />,
            disabled: approveSaving || isExpired,
            title: isExpired ? tr('Orçamento vencido: o check-out já passou e não pode ser aprovado.') : undefined,
            onClick: () => handleApprove(orc) },
          { label: tr('Cancelar'), icon: <Trash2 size={14} />, danger: true, divider: true, onClick: (_, anchor) => openCancelOrc(ev, orc, anchor) },
        ]} />}>
          <div className={[styles.rcCard, isCancelado ? styles.rvCancelado : ''].join(' ')}>
            <CabecalhoGaveta titulo={orc.nome_solicitante || tr('Orçamento')}
              chips={[isCancelado && { txt: tr('Cancelado'), red: true }, isExpired && { txt: tr('Vencido'), red: true }]}
              meta={[`${tr('Orçamento #')}${orc.id}`, orc.data_hora_registro].filter(Boolean).join(' · ')}
              onClose={() => setOrcAberto(null)} />
            <FaixaPeriodo inicio={inicios[0]} fim={fins[fins.length - 1]}
              celulas={[[hospedagens.length, hospedagens.length === 1 ? tr('Hospedagem') : tr('Hospedagens')], [nPessoas, nPessoas === 1 ? tr('Pessoa') : tr('Pessoas')]]} />

            <aside className={[styles.finResumo, styles.finResumoView].join(' ')}>
              <div className={styles.finCab}><h4 className={styles.finTit}>{tr('Resumo financeiro')}</h4></div>
              {hospedagens.map((h) => {
                const qid = h.quarto_id ?? h.quarto?.id ?? null;
                const ci = parseBrDate(h.data_hora_checkin);
                const co = parseBrDate(h.data_hora_checkout);
                return (
                  <div key={h.id} className={[styles.finLinha, mapStatus(h) === 'cancelado' ? styles.dtCancelado : ''].join(' ')}>
                    <span className={styles.finLinhaTxt}>
                      {qid ? <>{tr('Apartamento')} {fmtRoom(qid)}</> : tr('Hospedagem')}
                      {ci && co && <small className={styles.finSub}>{fmtDiaMes(ci)} → {fmtDiaMes(co)} · {diariasTxt(diffDays(ci, co))}</small>}
                    </span>
                    <b>{fmtBRL(h.valor_total ?? 0)}</b>
                  </div>
                );
              })}
              <hr className={styles.finSep} />
              <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Total do orçamento')}</span><b>{fmtBRL(grandTotal)}</b></div>
            </aside>

            <SecaoTabela titulo={tr('Hospedagens')} temLinhas={hospedagens.length > 0} vazio={tr('Nenhuma hospedagem neste orçamento.')}
              colunas={[[tr('Apto')], [tr('Período')], [tr('Hóspedes')], [tr('Valor'), true], ['']]}>
              {hospedagens.map((h) => {
                const ci = parseBrDate(h.data_hora_checkin);
                const co = parseBrDate(h.data_hora_checkout);
                const quartoId = h.quarto_id ?? h.quarto?.id ?? null;
                const pessoas  = h.pessoas_orcamento ?? [];
                const motivo   = h.motivo_cancelamento?.motivo_cancelamento ?? null;
                return (
                  <tr key={h.id} className={mapStatus(h) === 'cancelado' ? styles.dtCancelado : ''}>
                    <td><span className={styles.dtNum}>{quartoId ? fmtRoom(quartoId) : '—'}</span></td>
                    <td>
                      <span className={styles.dtCelTit}>{fmtDiaMes(ci)} → {fmtDiaMes(co)}</span>
                      <span className={styles.dtCelSub}>{ci && co ? diariasTxt(diffDays(ci, co)) : ''}</span>
                    </td>
                    <td className={styles.dtQuebra}>
                      {pessoas.length ? pessoas.map((p) => p.nome).join(', ') : '—'}
                      {(h.observacao || motivo) && <span className={styles.dtCelSub}>{motivo || h.observacao}</span>}
                    </td>
                    <td className={[styles.dtDir, styles.dtForte].join(' ')}>{fmtBRL(h.valor_total ?? 0)}</td>
                    <td className={styles.dtSetaCel}>
                      {pessoas.length > 0 && onSelectReserva && (
                        <button type="button" className={styles.dtSeta} onClick={() => verHosp(orc, h)} title={tr('Ver reserva')} aria-label={tr('Ver reserva')}>
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </SecaoTabela>
          </div>
        </GavetaDir>
      );
    })()}

    {/* ── Modal: editar nome do orçamento ── */}
    <Modal open={!!editOrc} onClose={() => { setEditOrc(null); setEditNome(''); }} size="sm"
      title={<><Pencil size={14} /> {tr('Editar Orçamento')}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={() => { setEditOrc(null); setEditNome(''); }}>{tr('Cancelar')}</Button>
          <Button variant="primary" disabled={!editNome.trim() || editSaving} onClick={handleSaveEditNome}>
            {editSaving && <Loader2 size={13} className={styles.spin} />} {tr('Salvar')}
          </Button>
        </div>
      }
    >
      <div className={styles.formStack}>
        <FormField label={tr('Nome do Solicitante')}>
          <input
            className={styles.formInput}
            value={editNome}
            onChange={(e) => setEditNome(e.target.value.toUpperCase())}
            placeholder={tr('NOME DO SOLICITANTE')}
            style={{ textTransform: 'uppercase' }}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditNome(); }}
          />
        </FormField>
      </div>
    </Modal>

    {/* ── Cancelar orçamento: balão de decisão (gaveta) ou modal ── */}
    {cancelOrc && cancelAnchor && (
      <Balao anchor={cancelAnchor} onClose={fecharCancelOrc}>
        <p className={styles.balaoMsg}>
          {tr('Cancelar o orçamento de')} <b>{cancelOrc.nome_solicitante}</b>? {tr('Esta ação não pode ser desfeita.')}
        </p>
        <textarea className={[styles.motivoTextarea, styles.balaoCampo].join(' ')} rows={2} autoFocus
          placeholder={tr('Motivo do cancelamento')} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
        <BalaoAcoes onCancelar={fecharCancelOrc} cancelarTxt={tr('Voltar')} perigo
          confirmar={cancelSaving ? <Loader2 size={13} className={styles.spin} /> : tr('Cancelar')}
          disabled={!cancelMotivo.trim() || cancelSaving} onConfirmar={handleConfirmCancel} />
      </Balao>
    )}
    <Modal open={!!cancelOrc && !cancelAnchor} onClose={() => { setCancelOrc(null); setCancelMotivo(''); }} size="sm"
      title={<><Trash2 size={14} /> {tr('Cancelar Orçamento')}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={() => { setCancelOrc(null); setCancelMotivo(''); }}>{tr('Voltar')}</Button>
          <Button variant="danger" disabled={!cancelMotivo.trim() || cancelSaving} onClick={handleConfirmCancel}>
            {cancelSaving && <Loader2 size={13} className={styles.spin} />} {tr('Cancelar Definitivamente')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>
          {tr('Informe o motivo do cancelamento do orçamento de')}{' '}
          <b>{cancelOrc?.nome_solicitante}</b>:
        </p>
        <textarea
          className={styles.motivoTextarea}
          placeholder={tr('Ex.: Solicitação do cliente')}
          rows={3}
          value={cancelMotivo}
          onChange={(e) => setCancelMotivo(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
    </>
  );
}



// ─── Solicitações Modal ───────────────────────────────────────────────────────
function SolicitacoesModal({ onClose, onSelectReserva }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);

  const fetchSolicitacoes = useCallback(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: 'RESERVA_SOLICITADA' })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const out  = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
        }
        setSolicitacoes(out.filter((r) => r.dataInicio));
      })
      .catch(() => setSolicitacoes([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { fetchSolicitacoes(); }, []); // eslint-disable-line

  return (
    <>
      {showCreate && (
        <CreateModal
          forceSolicitacao
          reservas={[]}
          categorias={[]}
          tiposPagamento={[]}
          roomDescMap={{}}
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); fetchSolicitacoes(); }}
          onNotify={() => {}}
        />
      )}

      <Janela open={!showCreate} onClose={onClose} size="md"
        title={<><Bell size={15} /> {tr('Solicitações')}{!loading && solicitacoes.length > 0 && <span className={styles.janelaChip}>{solicitacoes.length} {tr('pendente')}{solicitacoes.length !== 1 ? 's' : ''}</span>}</>}
      >
        {loading ? (
          <Esqueleto />
        ) : solicitacoes.length === 0 ? (
          <div className={styles.emptyState}>{tr('Nenhuma solicitação pendente.')}</div>
        ) : (
          <div className={styles.dayRoomList}>
            {solicitacoes.map((r) => (
              <div key={r.id} className={styles.dayRoomRow} onClick={() => onSelectReserva(r)}>
                <div className={styles.searchDropInfo}>
                  <div className={styles.searchDropName}>{r.pessoasOrcamento?.[0]?.nome ?? r.titularNome}</div>
                  <div className={styles.searchDropMeta}>
                    {tr('Apartamento')} {fmtRoom(r.quarto)} · {fmtDiaMes(r.dataInicio)} → {fmtDiaMes(r.dataFim)} · {diariasTxt(diffDays(r.dataInicio, r.dataFim))}
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </Janela>
    </>
  );
}

// ─── Room Combobox (single or multi-select) ───────────────────────────────────
function RoomCombobox({ value, onChange, availableRooms, categorias, roomDescMap = {}, singleSelect = false, disabled = false, loading = false }) {
  const [open,      setOpen]      = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 220;
    const openAbove = spaceBelow < dropH && rect.top > dropH;
    const w    = Math.min(Math.max(rect.width, 228), window.innerWidth - 16); // largura mínima mesmo com o campo estreito
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    setDropStyle({
      position: 'fixed',
      zIndex: 9999,
      width: w,
      left,
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 4,
      maxHeight: Math.min(dropH, openAbove ? rect.top - 8 : spaceBelow - 8),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const h = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inDrop    = dropRef.current    && dropRef.current.contains(e.target);
      if (!inTrigger && !inDrop) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSelect = (r) => {
    if (!availableRooms.includes(r)) return;
    if (singleSelect) {
      onChange([String(r)]);
      setOpen(false);
    } else {
      const rs = String(r);
      onChange(value.includes(rs) ? value.filter((x) => x !== rs) : [...value, rs]);
    }
  };

  const label = value.length === 0
    ? (singleSelect ? tr('Selecione um apartamento...') : tr('Selecione apartamento(s)...'))
    : tr('Apartamento {{v0}}{{v1}}', { v0: fmtRoom(parseInt(value[0])), v1: !singleSelect && value.length > 1 ? ` +${value.length - 1}` : '' });

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.comboDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      {categorias.map((cat) => {
        const rows = cat.quartos;
        if (!rows.length) return null;
        return (
          <div key={cat.id}>
            <div className={styles.comboGroupLabel}>{cat.nome}</div>
            {rows.map((r) => {
              const avail = availableRooms.includes(r);
              const sel   = value.includes(String(r));
              return (
                <div key={r}
                  className={[styles.comboItem, sel ? styles.comboItemSel : '', !avail ? styles.comboItemUnavail : ''].join(' ')}
                  onClick={() => handleSelect(r)}
                >
                  {!singleSelect && (
                    <div className={[styles.comboCheck, sel ? styles.comboCheckSel : ''].join(' ')}>{sel && '✓'}</div>
                  )}
                  <span className={styles.comboItemNum}>{fmtRoom(r)}</span>
                  <span className={styles.comboItemTxt}>
                    <b>{tr('Apartamento')} {fmtRoom(r)}</b>
                    {roomDescMap[r] && <small>{roomDescMap[r]}</small>}
                  </span>
                  {!avail && <span className={styles.comboItemOcupado}>{tr('Ocupado')}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
      {/* Múltipla seleção: fecha pelo botão, além do clique fora */}
      {!singleSelect && (
        <div className={styles.comboRodape}>
          <button type="button" className={styles.rvSecBtn} onClick={() => setOpen(false)}>
            {value.length > 0 ? tr('Selecionar quartos ({{n}})', { n: value.length }) : tr('Selecionar quartos')}
          </button>
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div className={styles.comboWrap}>
      <button ref={triggerRef} type="button" className={styles.comboTrigger}
        onClick={() => { if (!disabled && !loading) setOpen((o) => !o); }}
        disabled={disabled || loading} style={(disabled || loading) ? { opacity: loading ? 1 : 0.45, cursor: loading ? 'wait' : 'not-allowed' } : undefined}
      >
        {loading ? (
          <span className={styles.comboPlaceholder} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={styles.sk} style={{ width: 160 }} />
          </span>
        ) : value.length > 0 ? (
          <div className={styles.comboChipsInline}>
            {value.map((q) => (
              <div key={q} className={styles.hospedeChipRect}>
                <span>{tr('Apartamento')} {fmtRoom(parseInt(q))}</span>
                <button type="button" className={styles.chipRemove}
                  onClick={(e) => { e.stopPropagation(); if (singleSelect) onChange([]); else handleSelect(parseInt(q)); }}><X size={10} /></button>
              </div>
            ))}
          </div>
        ) : (
          <span className={styles.comboPlaceholder}>{label}</span>
        )}
        {loading
          ? <Loader2 size={13} className={styles.spin} style={{ flexShrink: 0, opacity: 0 }} />
          : <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
        }
      </button>
      {dropdown}
    </div>
  );
}

// ─── Sem Cadastro Hospedes Picker (orçamento sem cadastro) ───────────────────
function SemCadastroHospedesPicker({ value = [], onChange, onDraftChange }) {
  const autoNome = (len) => `ADULTO ${len + 1}`;
  const isAutoNome = (s) => /^ADULTO \d+$/i.test(s.trim());

  const [nome,     setNome]     = useState(() => autoNome(value.length));
  const [dob,      setDob]      = useState(null);
  const [isAdulto, setIsAdulto] = useState(true);

  // Atualiza o campo automaticamente quando o tamanho da lista muda,
  // mas só se o usuário ainda está com o nome automático (ou vazio)
  useEffect(() => {
    setNome((prev) => (prev === '' || isAutoNome(prev) ? autoNome(value.length) : prev));
  }, [value.length]); // eslint-disable-line

  const canAdd   = nome.trim().length > 0 && (isAdulto || dob !== null);
  const hasDraft = !isAutoNome(nome) || dob !== null; // draft real = nome customizado ou dob preenchido

  useEffect(() => { onDraftChange?.(hasDraft); }, [hasDraft]); // eslint-disable-line

  const adulto18Date = () => {
    const t = new Date();
    return formatDate(new Date(t.getFullYear() - 18, t.getMonth(), t.getDate()));
  };

  const add = () => {
    if (!canAdd) return;
    const dataNascimento = isAdulto ? adulto18Date() : formatDate(dob);
    onChange([...value, { nome: nome.trim(), dataNascimento, _adulto: isAdulto }]);
    // próximo nome é atualizado pelo useEffect acima (value.length cresce)
    setDob(null);
  };

  const rem = (i) => onChange(value.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className={styles.semCadastroAddRow}>
        <input
          className={styles.formInput}
          style={{ flex: 1, minWidth: 0 }}
          type="text"
          placeholder={tr('Nome do hóspede')}
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <label className={styles.empresaModeToggle}>
          <input type="checkbox" checked={isAdulto} onChange={(e) => { setIsAdulto(e.target.checked); if (e.target.checked) setDob(null); }} />
          <span>{tr('Adulto')}</span>
        </label>
        {!isAdulto && (
          <div style={{ width: 150, flexShrink: 0 }}>
            <DatePicker value={dob} onChange={setDob} placeholder={tr('Nascimento')} maxDate={new Date()} />
          </div>
        )}
        <button type="button" className={styles.addOrcGuestBtn} onClick={add} disabled={!canAdd}>
          <Plus size={13} /> {tr('Adicionar Hóspede')}
        </button>
      </div>
      {value.length > 0 && (
        <div className={styles.selectedChips}>
          {value.map((p, i) => (
            <div key={i} className={styles.hospedeChipRect}>
              <span>{p.nome}</span>
              {p._adulto
                ? <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{tr('Adulto')}</span>
                : p.dataNascimento && <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{fmtDateBR(p.dataNascimento)}</span>
              }
              <button type="button" className={styles.chipRemove} onClick={() => rem(i)}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Room Hospedes Picker ─────────────────────────────────────────────────────
function RoomHospedesPicker({ value = [], onChange }) {
  const [search,        setSearch]        = useState('');
  const [results,       setResults]       = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [dropStyle,     setDropStyle]     = useState({});
  const [pending,       setPending]       = useState(null); // { type:'pessoa'|'empresa', ... }
  const [isEmpresaMode, setIsEmpresaMode] = useState(false);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);
  const dropRef  = useRef(null);

  const mapPessoa = (p) => ({
    id: p.id, nome: p.nome, cpf: p.cpf ?? '',
    dataNascimento: p.data_nascimento ?? '',
    bloqueado: p.status === 'BLOQUEADO',
    acompanhantes: (p.acompanhantes ?? []).map((a) => ({
      id: a.id, nome: a.nome, cpf: a.cpf ?? '',
      dataNascimento: a.data_nascimento ?? '',
      bloqueado: a.status === 'BLOQUEADO',
      idade: a.idade ?? null,
    })),
  });
  const mapEmpresa = (e) => ({
    id: e.id,
    nome: e.razao_social ?? e.razaoSocial ?? e.nome_fantasia ?? e.nomeFantasia ?? '',
    nomeFantasia: e.nome_fantasia ?? e.nomeFantasia ?? '',
    isEmpresa: true,
  });

  // Ao focar o campo (sem busca digitada), mostra os 10 cadastros mais recentes.
  const loadRecent = async () => {
    if (search.trim().length >= 2 || pending) return;
    setSearching(true);
    try {
      if (isEmpresaMode) {
        const res  = await cadastroApi.listarEmpresas({ size: 10, page: 0 });
        const list = Array.isArray(res) ? res : (res.content ?? []);
        setResults(list.map(mapEmpresa));
      } else {
        const res  = await cadastroApi.listarPessoas({ ordenacao: 'DATA_CADASTRO', direcao: 'DESC', size: 10 });
        const list = Array.isArray(res) ? res : (res.content ?? []);
        setResults(list.map(mapPessoa));
      }
    } catch { setResults([]); }
    finally  { setSearching(false); }
  };

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setPending(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        if (isEmpresaMode) {
          const res  = await cadastroApi.listarEmpresas({ termo: search.trim(), size: 15, page: 0 });
          const list = Array.isArray(res) ? res : (res.content ?? []);
          setResults(list.map(mapEmpresa));
        } else {
          const res  = await cadastroApi.listarPessoas({ termo: search.trim(), size: 6 });
          const list = Array.isArray(res) ? res : (res.content ?? []);
          setResults(list.map(mapPessoa));
        }
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, isEmpresaMode]);

  const calcDropPos = (maxH = 260) => {
    const el = wrapRef.current ?? inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top - 8;
    setDropStyle({ position: 'fixed', zIndex: 99999, left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width, maxHeight: Math.min(maxH, spaceAbove) });
  };

  useEffect(() => { if (results.length) calcDropPos(); }, [results]);

  const addMany = (list) => {
    const existing = new Set(value.map((x) => x.id));
    const toAdd = list.filter((h) => !existing.has(h.id));
    if (toAdd.length) onChange([...value, ...toAdd]);
  };

  const handleResultClick = async (h) => {
    if (h.isEmpresa) {
      setSearching(true);
      try {
        const res     = await cadastroApi.buscarEmpresaPorId(h.id);
        const empresa = res?.content?.[0] ?? res;
        const vinculados = (empresa.pessoas_vinculadas ?? empresa.pessoasVinculadas ?? []).map((p) => ({
          id: p.id, nome: p.nome, cpf: p.cpf ?? '',
          dataNascimento: p.data_nascimento ?? '',
          bloqueado: p.status === 'BLOQUEADO',
        }));
        if (vinculados.length === 0) { setSearch(''); setResults([]); return; }
        const allActive = new Set(vinculados.filter((v) => !v.bloqueado).map((v) => v.id));
        setPending({ type: 'empresa', empresa: { id: empresa.id, nome: h.nome }, vinculados, selected: allActive });
        calcDropPos(320);
      } catch { /* silent */ } finally { setSearching(false); }
      return;
    }
    if (h.bloqueado) return;
    if (h.acompanhantes?.length > 0) {
      setPending({ type: 'pessoa', titular: h, selected: new Set() });
      calcDropPos(320);
    } else {
      addMany([h]);
      setSearch(''); setResults([]);
    }
  };

  const toggleCompanion = (id) => setPending((prev) => {
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });

  const confirmAdd = () => {
    if (pending.type === 'empresa') {
      const toAdd = pending.vinculados.filter((v) => !v.bloqueado && pending.selected.has(v.id));
      addMany(toAdd.map((v) => ({ ...v, _empresa: pending.empresa })));
    } else {
      const toAdd = [pending.titular,
        ...pending.titular.acompanhantes.filter((a) => !a.bloqueado && pending.selected.has(a.id)),
      ];
      addMany(toAdd);
    }
    setPending(null); setSearch(''); setResults([]);
  };

  const confirmPessoaOnly = () => {
    addMany([pending.titular]);
    setPending(null); setSearch(''); setResults([]);
  };

  const rem = (id) => onChange(value.filter((x) => x.id !== id));

  const toggleEmpresaMode = (checked) => {
    setIsEmpresaMode(checked);
    setSearch(''); setResults([]); setPending(null);
  };

  const showDrop = pending !== null || results.length > 0;

  // Fecha a lista ao clicar fora do campo ou do dropdown.
  useEffect(() => {
    if (!showDrop) return;
    const handlePointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setResults([]); setPending(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showDrop]);

  const dropdown = showDrop && createPortal(
    <div ref={dropRef} className={styles.searchResultsList} style={{ ...dropStyle, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
      {pending ? (
        <>
          <div className={styles.companionHeader}>
            <button className={styles.companionBack} onClick={() => setPending(null)}><ChevronLeft size={12} /> {tr('Voltar')}</button>
            {pending.type === 'empresa' && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pending.empresa.nome}
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {pending.type === 'empresa' ? (
              pending.vinculados.map((v) => (
                <div key={v.id}
                  className={[styles.companionRow, v.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
                  onClick={() => !v.bloqueado && toggleCompanion(v.id)}>
                  <div className={[styles.companionCheck, pending.selected.has(v.id) ? styles.companionChecked : ''].join(' ')}>
                    {pending.selected.has(v.id) && <Check size={11} />}
                  </div>
                  <div className={styles.companionInfo}>
                    <span className={styles.companionName}>{v.nome}</span>
                    {v.cpf && <span className={styles.companionMeta}>{fmtCpf(v.cpf)}</span>}
                  </div>
                  {v.bloqueado && <span className={styles.blockedChip}>{tr('Bloqueado')}</span>}
                </div>
              ))
            ) : (
              <>
                <div className={styles.companionRow}>
                  <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
                  <div className={styles.companionInfo}>
                    <span className={styles.companionName}>{pending.titular.nome}</span>
                    {pending.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pending.titular.cpf)}</span>}
                  </div>
                  <span className={styles.titularChip}>{tr('Titular')}</span>
                </div>
                {pending.titular.acompanhantes.map((a) => (
                  <div key={a.id}
                    className={[styles.companionRow, a.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
                    onClick={() => !a.bloqueado && toggleCompanion(a.id)}>
                    <div className={[styles.companionCheck, pending.selected.has(a.id) ? styles.companionChecked : ''].join(' ')}>
                      {pending.selected.has(a.id) && <Check size={11} />}
                    </div>
                    <div className={styles.companionInfo}>
                      <span className={styles.companionName}>{a.nome}</span>
                      <span className={styles.companionMeta}>
                        {a.cpf ? fmtCpf(a.cpf) : ''}{a.idade ? tr(' · {{idade}} anos', { idade: a.idade }) : ''}
                      </span>
                    </div>
                    {a.bloqueado && <span className={styles.blockedChip}>{tr('Bloqueado')}</span>}
                  </div>
                ))}
              </>
            )}
          </div>
          <div className={styles.companionActions}>
            {pending.type === 'empresa' ? (
              <>
                <button className={styles.companionBtnSecondary} onClick={() => setPending(null)}>{tr('Cancelar')}</button>
                <button className={styles.companionBtnPrimary} onClick={confirmAdd} disabled={pending.selected.size === 0}>
                  {tr('Adicionar')}{pending.selected.size > 0 ? ` (${pending.selected.size})` : ''} →
                </button>
              </>
            ) : (
              <>
                <button className={styles.companionBtnSecondary} onClick={confirmPessoaOnly}>{tr('Só o titular')}</button>
                <button className={styles.companionBtnPrimary} onClick={confirmAdd}>{tr('Adicionar →')}</button>
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className={styles.buscaTitulo}>
            {search.trim().length >= 2 ? tr('Buscando por “{{v}}”…', { v: search.trim() }) : tr('Adicionados recentemente')}
          </div>
          {results.map((h) => (
            <div key={h.id}
              className={[styles.searchResultItem, !h.isEmpresa && h.bloqueado ? styles.searchResultBlocked : ''].join(' ')}
              onClick={() => handleResultClick(h)}>
              <div className={styles.searchResultName}>{h.nome}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!h.isEmpresa && h.cpf && <div className={styles.hospedeCpf}>{fmtCpf(h.cpf)}</div>}
                {!h.isEmpresa && h.acompanhantes?.length > 0 && !h.bloqueado && <span className={styles.companionCountChip}>{h.acompanhantes.length} {tr('acomp.')}</span>}
                {!h.isEmpresa && h.bloqueado && <span className={styles.blockedChip}>{tr('Bloqueado')}</span>}
              </div>
              <ChevronRight size={13} className={styles.addIcon} />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div ref={wrapRef} className={styles.hospSearchWrap} style={{ flex: 1, minWidth: 0 }}>
          {searching
            ? <Loader2 size={13} className={[styles.hospSearchIcon, styles.spin].join(' ')} />
            : <Search size={13} className={styles.hospSearchIcon} />}
          <div className={styles.hospInputInner}>
            {value.map((h) => (
              <div key={h.id} className={styles.hospedeChipRect}>
                <span>{h.nome}</span>
                <button type="button" className={styles.chipRemove} onClick={() => rem(h.id)}><X size={10} /></button>
              </div>
            ))}
            <input ref={inputRef} className={styles.hospInlineInput} value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={loadRecent}
              placeholder={value.length === 0 ? (isEmpresaMode ? tr('Buscar empresa...') : tr('Buscar hóspede...')) : ''} />
          </div>
        </div>
        <label className={styles.empresaModeToggle}>
          <input type="checkbox" checked={isEmpresaMode} onChange={(e) => toggleEmpresaMode(e.target.checked)} />
          <span>{tr('Empresa')}</span>
        </label>
      </div>
      {dropdown}
    </div>
  );
}

// ─── Create Reservation Modal ─────────────────────────────────────────────────
export function CreateModal({ initialRoom, initialStart, initialEnd, initialAvailable, reservas, onClose, onSave, onNotify, categorias, tiposPagamento, roomDescMap = {}, forceOrcamento = false, forceSolicitacao = false, forcePernoite = false, initialGrupo = null }) {
  const isSolicitacao = forceSolicitacao;

  const [step,             setStep]             = useState((!isSolicitacao && initialRoom) ? 2 : 1);
  const [tipo,             setTipo]             = useState('simples'); // 'simples' | 'grupo'

  // Passos opcionais — só aparecem quando a escolha faz diferença:
  //  · "Modo de Período": vários apartamentos podem ter períodos distintos
  //    (não se aplica com quarto pré-selecionado nem no pernoite, sempre um período).
  //  · "Modo de Pagamento": solicitação e orçamento não registram pagamento e,
  //    com um apartamento só, as duas opções teriam o mesmo efeito.
  const hasPeriodoStep = tipo === 'grupo' && !initialRoom && !forcePernoite;
  const hasPagStep     = !forceSolicitacao && !forceOrcamento && tipo === 'grupo';
  const stepDefs = [
    { id: 'tipo',     label: tr('Tipo de Reserva') },
    ...(hasPeriodoStep ? [{ id: 'periodo', label: tr('Modo de Período') }] : []),
    { id: 'dados',    label: isSolicitacao ? tr('Período & Hóspedes') : tr('Apartamento, Período & Hóspedes') },
    ...(hasPagStep     ? [{ id: 'pagamento', label: tr('Modo de Pagamento') }] : []),
    { id: 'resumo',   label: isSolicitacao ? tr('Resumo') : tr('Resumo & Pagamento') },
  ];
  const STEPS        = stepDefs.map((s) => s.label);
  const stepNo       = (id) => stepDefs.findIndex((s) => s.id === id) + 1; // 0 = passo inexistente
  const PERIODO_STEP = stepNo('periodo');
  const DADOS_STEP   = stepNo('dados');
  const PAG_STEP     = stepNo('pagamento');
  const SUMMARY_STEP = stepDefs.length;
  const isOrcamento = forceOrcamento; // orçamento é sempre sem cadastro quando forceOrcamento
  const [nomeSolicitante,  setNomeSolicitante]  = useState(''); // nome do solicitante para orçamentos

  // Step 2: período único. No modo pernoite o check-in é sempre hoje (travado).
  const [quartos,        setQuartos]        = useState(initialRoom ? [String(initialRoom)] : []);
  const [checkin,        setCheckin]        = useState(forcePernoite ? new Date() : (initialStart ? new Date(initialStart + 'T00:00:00') : null));
  const [checkout,       setCheckout]       = useState(initialEnd   ? new Date(initialEnd   + 'T00:00:00') : null);
  const [quartoHospedes,    setQuartoHospedes]    = useState({}); // { [quartoId]: [hospede] } — registered
  const [quartoHospedesOrc, setQuartoHospedesOrc] = useState({}); // { [quartoId]: [{ nome, dataNascimento }] } — sem cadastro

  // Step 2: vincular a grupo existente (grupo_id) — opcional. Busca todos os grupos no backend
  // para não depender das reservas do mês visível.
  const [grupoVinculado,    setGrupoVinculado]    = useState(initialGrupo);
  // Responsável do grupo — vai para grupo_reserva.descricao ao criar um grupo novo.
  const [grupoResponsavel,  setGrupoResponsavel]  = useState('');
  const [gruposExistentes,  setGruposExistentes]  = useState([]);
  useEffect(() => {
    if (isOrcamento || isSolicitacao) return;
    let cancel = false;
    hospedagemApi.listarGrupos()
      .then((list) => { if (!cancel) setGruposExistentes(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancel) setGruposExistentes([]); });
    return () => { cancel = true; };
  }, [isOrcamento, isSolicitacao]);

  // Step 2: múltiplos períodos
  const [periodoMode,    setPeriodoMode]    = useState('unico'); // 'unico' | 'multiplos'
  const [periodos,       setPeriodos]       = useState([]);      // [{ rooms, checkin, checkout, roomHospedes, roomHospedesOrc }]
  const [mpRooms,        setMpRooms]        = useState([]);
  // Múltiplos períodos: o primeiro período também já abre com as datas recebidas
  // (ex.: nova reserva a partir de um grupo de período único).
  const [mpCheckin,      setMpCheckin]      = useState(initialStart ? new Date(initialStart + 'T00:00:00') : null);
  const [mpCheckout,     setMpCheckout]     = useState(initialEnd   ? new Date(initialEnd   + 'T00:00:00') : null);
  const [mpRoomHospedes,    setMpRoomHospedes]    = useState({});
  const [mpRoomHospedesOrc, setMpRoomHospedesOrc] = useState({});
  const [editingPeriodoIdx, setEditingPeriodoIdx] = useState(null); // index of period being edited

  // Step 3: Pagamentos

  const [quartosPag,     setQuartosPag]     = useState({});         // { [quartoId]: [payment] } individual
  const [pagModo,        setPagModo]        = useState('por_quarto'); // 'por_quarto' | 'unico'
  const [pagUnico,       setPagUnico]       = useState([]);           // payments for pagamento único mode
  const [showPagModal,   setShowPagModal]   = useState(false);
  const [showPagModalRoom, setShowPagModalRoom] = useState(null);   // quartoId for individual mode
  const [quartosObs,     setQuartosObs]     = useState({}); // { [quartoId]: string }
  const [saving,      setSaving]      = useState(false);
  const [precosCalc,       setPrecosCalc]       = useState({}); // { [`${quartoId}_${periodoIdx}`]: calcResponse }
  const [calcLoading,      setCalcLoading]      = useState(false);
  const [obsOpen,          setObsOpen]          = useState({}); // { [`${q}_${pi}`]: bool } — textarea de observação revelado
  const [roomOpen,         setRoomOpen]         = useState({}); // { [rKey]: bool } — card do apartamento expandido (fechado por padrão)
  const [priceAdj,         setPriceAdj]         = useState({}); // { [rKey]: { mode, sign, value, qtdPessoas } }
  const [adjModalKey,      setAdjModalKey]      = useState(null); // rKey do modal de ajuste aberto
  const [apiAvailability,      setApiAvailability]      = useState(null); // Set<roomId> | null
  const [mpApiAvailability,    setMpApiAvailability]    = useState(null); // Set<roomId> | null
  const [availLoading,         setAvailLoading]         = useState(false);
  const [mpAvailLoading,       setMpAvailLoading]       = useState(false);

  // Derived
  const checkinStr  = checkin  ? formatDate(checkin)  : '';
  const checkoutStr = checkout ? formatDate(checkout) : '';
  const dias        = checkinStr && checkoutStr ? diffDays(checkinStr, checkoutStr) : 0;

  const allRoomIds = useMemo(() => categorias.flatMap((c) => c.quartos), [categorias]);

  // Horários (checkin/checkout) definidos pela categoria do quarto (fallback 14:00 / 12:00).
  const roomCatTimes = (quartoId) => {
    const cat = categorias.find((c) => (c.quartos || []).map(String).includes(String(quartoId)));
    return { checkin: cat?.checkin || '14:00', checkout: cat?.checkout || '12:00' };
  };

  // Se algum quarto selecionado tem uma MEIA DIÁRIA encerrando no dia do check-in, o quarto só fica
  // livre após aquele horário — o funcionário precisa definir a hora de entrada manualmente.
  const [checkinHour, setCheckinHour] = useState('');
  const halfDailyMinCheckin = useMemo(() => {
    if (periodoMode !== 'unico' || !checkinStr || !quartos.length) return null;
    let max = null;
    for (const r of (reservas || [])) {
      if (!r.meiaDiaria || r.dataFim !== checkinStr) continue;
      if (!quartos.map(String).includes(String(r.quarto))) continue;
      const hr = (r.saidaPrevista || '').split(' ')[1]?.slice(0, 5);
      if (hr && (!max || hr > max)) max = hr;
    }
    return max;
  }, [periodoMode, checkinStr, quartos, reservas]);
  useEffect(() => {
    if (halfDailyMinCheckin) setCheckinHour((h) => (h && h >= halfDailyMinCheckin ? h : halfDailyMinCheckin));
  }, [halfDailyMinCheckin]);

  // Meia diária: o hóspede sai depois da hora de checkout da categoria e paga meio valor por
  // isso. A reserva guarda só a hora de saída; a diária extra quem monta é o back-end.
  // Com vários apartamentos o horário exibido é o checkout mais tarde entre eles; na hora de
  // montar o corpo, cada apartamento é comparado com o checkout da própria categoria.
  const [meiaDiaria, setMeiaDiaria] = useState(false);
  const [horaSaidaMeia, setHoraSaidaMeia] = useState('');
  const checkoutCatHora = quartos.length
    ? quartos.reduce((max, q) => { const h = roomCatTimes(q).checkout; return h > max ? h : max; }, '00:00')
    : '12:00';
  // Só vale como meia diária quando a saída é de fato depois do checkout da categoria.
  const temMeiaDiaria = meiaDiaria && !!horaSaidaMeia && horaSaidaMeia > checkoutCatHora;

  // Fetch availability from API whenever unico-mode dates change
  useEffect(() => {
    if (!checkin || !checkout || !allRoomIds.length) { setApiAvailability(null); setAvailLoading(false); return; }
    let cancelled = false;
    setAvailLoading(true);
    setApiAvailability(null);
    reservaApi.verificarDisponibilidade({
      data_entrada: toBrDate(checkinStr),
      data_saida: toBrDate(checkoutStr),
    }).then((results) => {
      if (cancelled) return;
      const avail = new Set(
        (Array.isArray(results) ? results : []).filter((r) => r.disponivel).map((r) => r.quarto_id ?? r.fk_quarto)
      );
      setApiAvailability(avail);
    }).catch(() => { if (!cancelled) setApiAvailability(null); })
      .finally(() => { if (!cancelled) setAvailLoading(false); });
    return () => { cancelled = true; };
  }, [checkinStr, checkoutStr]); // eslint-disable-line

  // Fetch availability for multiplos-mode form dates
  useEffect(() => {
    if (!mpCheckin || !mpCheckout || !allRoomIds.length) { setMpApiAvailability(null); setMpAvailLoading(false); return; }
    let cancelled = false;
    setMpAvailLoading(true);
    setMpApiAvailability(null);
    reservaApi.verificarDisponibilidade({
      data_entrada: toBrDate(formatDate(mpCheckin)),
      data_saida: toBrDate(formatDate(mpCheckout)),
    }).then((results) => {
      if (cancelled) return;
      const avail = new Set(
        (Array.isArray(results) ? results : []).filter((r) => r.disponivel).map((r) => r.quarto_id ?? r.fk_quarto)
      );
      setMpApiAvailability(avail);
    }).catch(() => { if (!cancelled) setMpApiAvailability(null); })
      .finally(() => { if (!cancelled) setMpAvailLoading(false); });
    return () => { cancelled = true; };
  }, [mpCheckin, mpCheckout]); // eslint-disable-line

  const availableRooms = useMemo(() => {
    if (!checkinStr || !checkoutStr) return initialAvailable || allRoomIds;
    if (apiAvailability) return allRoomIds.filter((r) => apiAvailability.has(r));
    return allRoomIds.filter(
      (r) => !reservas.some((res) => res.quarto === r && res.dataInicio < checkoutStr && res.dataFim > checkinStr)
    );
  }, [checkinStr, checkoutStr, reservas, initialAvailable, allRoomIds, apiAvailability]);

  const mpAvailableRooms = useMemo(() => {
    if (!mpCheckin || !mpCheckout) return allRoomIds;
    const ci = formatDate(mpCheckin);
    const co = formatDate(mpCheckout);
    const alreadyPicked = periodos.flatMap((p, idx) => {
      if (idx === editingPeriodoIdx) return [];
      const pi = formatDate(p.checkin); const po = formatDate(p.checkout);
      if (pi < co && po > ci) return p.rooms.map((r) => parseInt(r));
      return [];
    });
    const baseAvail = mpApiAvailability
      ? allRoomIds.filter((r) => mpApiAvailability.has(r))
      : allRoomIds.filter((r) => !reservas.some((res) => res.quarto === r && res.dataInicio < co && res.dataFim > ci));
    return baseAvail.filter((r) => !alreadyPicked.includes(r));
  }, [mpCheckin, mpCheckout, periodos, editingPeriodoIdx, reservas, allRoomIds, mpApiAvailability]);


  const addPagamento = (payment) => {
    const entry = { _localId: Date.now(), _criadoEm: new Date().toLocaleString('pt-BR'), ...payment };
    if (pagModo === 'unico') {
      setPagUnico((prev) => [...prev, entry]);
    } else if (showPagModalRoom !== null) {
      setQuartosPag((prev) => ({ ...prev, [showPagModalRoom]: [...(prev[showPagModalRoom] || []), entry] }));
    }
    setShowPagModal(false);
    setShowPagModalRoom(null);
  };

  // Orçamento/Solicitação é sempre sem cadastro (pessoas_orcamento com nome + data de nascimento)
  const isOrcSemCadastro = isOrcamento || isSolicitacao;

  const resetMpForm = () => {
    setMpRooms([]); setMpCheckin(null); setMpCheckout(null);
    setMpRoomHospedes({}); setMpRoomHospedesOrc({});
    setEditingPeriodoIdx(null);
  };

  const addPeriodo = () => {
    if (!mpRooms.length || !mpCheckin || !mpCheckout) return;
    const entry = {
      rooms: [...mpRooms], checkin: mpCheckin, checkout: mpCheckout,
      roomHospedes:    { ...mpRoomHospedes },
      roomHospedesOrc: { ...mpRoomHospedesOrc },
    };
    if (editingPeriodoIdx !== null) {
      setPeriodos((ps) => ps.map((p, i) => i === editingPeriodoIdx ? entry : p));
    } else {
      setPeriodos((ps) => [...ps, entry]);
    }
    resetMpForm();
  };

  const startEditPeriodo = (i) => {
    const p = periodos[i];
    setMpRooms([...p.rooms]);
    setMpCheckin(p.checkin instanceof Date ? p.checkin : new Date(p.checkin + 'T00:00:00'));
    setMpCheckout(p.checkout instanceof Date ? p.checkout : new Date(p.checkout + 'T00:00:00'));
    setMpRoomHospedes({ ...(p.roomHospedes || {}) });
    setMpRoomHospedesOrc({ ...(p.roomHospedesOrc || {}) });
    setEditingPeriodoIdx(i);
  };

  const allSelectedRooms = periodoMode === 'multiplos'
    ? [...new Set(periodos.flatMap((p) => p.rooms))]
    : quartos;

  const [semCadastroDraft, setSemCadastroDraft] = useState(false);
  const mpFormDirty = periodoMode === 'multiplos' && (mpRooms.length > 0 || !!mpCheckin || !!mpCheckout || editingPeriodoIdx !== null);

  const hasGuestsForAllRooms = periodoMode === 'unico'
    ? quartos.length > 0 && quartos.every((q) => (quartoHospedes[q]?.length || 0) + (quartoHospedesOrc[q]?.length || 0) > 0)
    : periodos.length > 0 && periodos.every((p) => p.rooms.every((r) => (p.roomHospedes?.[r]?.length || 0) + (p.roomHospedesOrc?.[r]?.length || 0) > 0));

  // Reserva com mais de um apartamento precisa de um responsável pelo grupo.
  const totalAptosGrupo = periodoMode === 'unico' ? quartos.length : periodos.reduce((acc, pr) => acc + (pr.rooms?.length ?? 0), 0);
  const faltaResponsavel = !isOrcamento && !isSolicitacao && totalAptosGrupo > 1 && !grupoResponsavel.trim();
  const canNext2 = periodoMode === 'unico'
    ? quartos.length > 0 && checkinStr && checkoutStr && dias > 0 && hasGuestsForAllRooms && !semCadastroDraft
    : periodos.length > 0 && !mpFormDirty && hasGuestsForAllRooms && !semCadastroDraft;

  // Derived: all unique hospedes across all rooms/periods
  const allHospedes = useMemo(() => {
    const seen = new Set();
    const list = periodoMode === 'unico'
      ? Object.values(quartoHospedes).flat()
      : periodos.flatMap((p) => Object.values(p.roomHospedes || {}).flat());
    return list.filter((h) => { if (seen.has(h.id)) return false; seen.add(h.id); return true; });
  }, [periodoMode, quartoHospedes, periodos]);

  const isoToBr = (iso) => iso.split('-').reverse().join('/'); // "yyyy-MM-dd" → "dd/MM/yyyy"

  const runCalcPrecos = async () => {
    setCalcLoading(true);
    setPrecosCalc({});
    setObsOpen({});
    setPriceAdj({});
    try {
      const displayPeriodos = periodoMode === 'unico'
        ? [{ rooms: quartos, checkin: checkinStr, checkout: checkoutStr, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
        : periodos.map((p) => ({ ...p, checkin: formatDate(p.checkin), checkout: formatDate(p.checkout) }));

      // Build ordered list of { key, item } so we can map response[i] → key
      const indexed = [];
      displayPeriodos.forEach((p, pi) => {
        p.rooms.forEach((quartoId) => {
          const guests = isOrcSemCadastro
            ? (p.roomHospedesOrc?.[quartoId] || [])
            : (p.roomHospedes?.[quartoId]    || []);
          indexed.push({
            key:  `${quartoId}_${pi}`,
            quartoId,
            item: {
              fk_quarto:    parseInt(quartoId),
              data_entrada: toBrDate(p.checkin),
              data_saida:   toBrDate(p.checkout),
              ...buildGuestCalcParams(guests),
            },
          });
          // Saída tardia: o back-end precifica a meia diária pela noite do dia do check-out
          // (checkout → checkout+1) e divide por 2. O resumo pede exatamente essa noite, senão
          // os dois divergem sempre que a sazonalidade dela for diferente da noite anterior.
          if (meiaDiaria && horaSaidaMeia && horaSaidaMeia > roomCatTimes(quartoId).checkout) {
            indexed.push({
              key:  `${quartoId}_${pi}`,
              quartoId,
              meia: true,
              item: {
                fk_quarto:    parseInt(quartoId),
                data_entrada: toBrDate(p.checkout),
                data_saida:   toBrDate(addDays(p.checkout, 1)),
                ...buildGuestCalcParams(guests),
              },
            });
          }
        });
      });

      if (indexed.length === 0) return;
      // Orçamentos usam endpoint exclusivo /calcular-preco
      const calcFn = isOrcamento ? orcamentoApi.calcularPreco : reservaApi.calcularPreco;
      const resArray = await calcFn(indexed.map((x) => x.item));
      const results = {};
      const meias = {};
      (Array.isArray(resArray) ? resArray : []).forEach((r, i) => {
        const ix = indexed[i];
        if (!ix) return;
        if (ix.meia) meias[ix.key] = r;
        else results[ix.key] = r;
      });
      Object.entries(meias).forEach(([key, meiaCalc]) => {
        results[key] = comMeiaDiaria(results[key], meiaCalc);
      });
      setPrecosCalc(results);
    } finally {
      setCalcLoading(false);
    }
  };

  // Entra no resumo já com os preços calculados.
  const handleGoToResumo = async () => { setStep(SUMMARY_STEP); await runCalcPrecos(); };

  // Junta a meia diária da saída tardia ao resultado do apartamento. O /calcular-preco não
  // conhece o conceito: ele devolve a noite cheia do dia do check-out e aqui ela vira metade,
  // que é exatamente o que o back-end grava — o total enviado bate com o que ele recalcula.
  const comMeiaDiaria = (calc, meiaCalc) => {
    if (!calc || !meiaCalc) return calc;
    const noite = meiaCalc.detalhes?.[0] ?? {};
    const meiaValor = Math.round(((meiaCalc.valor_total ?? 0) / 2) * 100) / 100;
    if (meiaValor <= 0) return calc;
    return {
      ...calc,
      valor_total: (calc.valor_total ?? 0) + meiaValor,
      detalhes: [...(calc.detalhes ?? []), {
        ...noite,
        valor_final: meiaValor,
        valor_criancas: noite.valor_criancas != null ? noite.valor_criancas / 2 : null,
        meia_diaria: true,
      }],
    };
  };

  // Base original (sem ajuste) de uma hospedagem a partir dos detalhes calculados.
  const baseForKey = (rKey) => {
    const calc = precosCalc[rKey];
    const baseDiarias = (calc?.detalhes || []).map((d) => ({ valor: d.valor_final ?? 0 }));
    const baseTotal = baseDiarias.length
      ? baseDiarias.reduce((s, d) => s + d.valor, 0)
      : (calc?.valor_total ?? 0);
    return { baseTotal, baseDiarias };
  };

  // Monta o snapshot novo_preco para o corpo de criação (apenas se houver ajuste).
  const buildNovoPreco = (rKey) => {
    const adj = priceAdj[rKey];
    if (!adj) return null;
    const { baseTotal, baseDiarias } = baseForKey(rKey);
    const { valorTotal, requestFields } = computeAdjustedTotal({ baseTotal, baseDiarias, ...adj });
    return { ...requestFields, valor_total: valorTotal };
  };

  // Diárias com o mesmo valor viram uma linha só: "Diárias · 2 adultos ··· 3x R$ 120,00".
  // No modo "Por diária" o valor ajustado substitui o original (que fica riscado);
  // nos demais modos o ajuste vira uma linha única no fim. O total fica no box "Total".
  const renderRoomDiarias = (calc, adjKey, guestLabel, pagoIntegral = false) => {
    const adj = priceAdj[adjKey];
    const isDiariaAdj = adj?.mode === 'diaria';
    const novoValor = isDiariaAdj ? Math.max(0, Math.round((Number(adj.value) || 0) * 100) / 100) : null;
    const base = (calc.detalhes || []).reduce((s, d) => s + (d.valor_final ?? 0), 0);
    const diff = (calc.valor_total ?? 0) - base;
    const grupos = groupDiarias(calc.detalhes, isDiariaAdj ? () => novoValor : null);
    return (
      <>
        {grupos.map((g, gi) => (
          <div key={g.key} className={[styles.rcDiariaRow, pagoIntegral ? styles.rcDiariaPago : ''].join(' ')}>
            <span>
              {g.meia ? tr('Meia diária') : g.qtd > 1 ? tr('Diárias') : tr('Diária')}
              {diariaSubs(g, guestLabel) && (
                <span className={styles.rcDiariaSub}> · {diariaSubs(g, guestLabel)}</span>
              )}
            </span>
            <span className={styles.rcDiariaVal}>
              {/* Selo uma vez só, na última diária, para não repetir em cada linha. */}
              {pagoIntegral && gi === grupos.length - 1 && (
                <span className={styles.rcDiariaTag}>{tr('(Pago 100%)')}</span>
              )}
              {isDiariaAdj && <span className={styles.rcDiariaOld}>{fmtBRL(g.valorOriginal)}</span>}
              {g.qtd > 1 && <span className={styles.rcDiariaMult}>{g.qtd}{tr('x')} </span>}
              {fmtBRL(g.valor)}
            </span>
          </div>
        ))}
        {adj && !isDiariaAdj && Math.abs(diff) >= 0.005 && (
          <div className={styles.rcDiariaRow}>
            <span className={styles.rcDiariaSub}>{describeAdjustment(adj)}</span>
            <span className={styles.rcDiariaVal} style={{ color: diff < 0 ? 'var(--emerald)' : '#f97316' }}>
              {diff > 0 ? '+' : ''}{fmtBRL(diff)}
            </span>
          </div>
        )}
      </>
    );
  };

  // Pagamento por apartamento: resumo financeiro do quarto no desenho da view da reserva.
  const renderRoomResumo = (calc, adjKey, guestLabel, pago, onPagar) => {
    const adj = priceAdj[adjKey];
    const isDiariaAdj = adj?.mode === 'diaria';
    const novoValor = isDiariaAdj ? Math.max(0, Math.round((Number(adj.value) || 0) * 100) / 100) : null;
    const base   = (calc.detalhes || []).reduce((acc, d) => acc + (d.valor_final ?? 0), 0);
    const total  = calc.valor_total ?? 0;
    const diff   = total - base;
    const grupos = groupDiarias(calc.detalhes, isDiariaAdj ? () => novoValor : null);
    const pend   = Math.max(0, total - pago);
    const pct    = total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0;
    const quitado = total > 0 && pago >= total - 0.005;
    return (
      <aside className={[styles.finResumo, styles.finResumoView, styles.finResumoQuarto].join(' ')}>
        <div className={[styles.finCab, styles.finCabAcao].join(' ')}>
          <h4 className={styles.finTit}>{tr('Resumo financeiro')}</h4>
        </div>
        {grupos.map((g) => {
          const subs = diariaSubs({ ...g, saz: null }, guestLabel);
          return (
            <div key={g.key} className={styles.finLinha}>
              <span className={styles.finLinhaTxt}>
                {g.qtd > 1
                  ? tr('{{qtd}} diárias × {{valor}}', { qtd: g.qtd, valor: fmtBRL(g.valor) })
                  : g.meia ? tr('Meia diária') : grupos.length > 1 ? tr('{{n}}ª Diária', { n: g.numeros[0] }) : tr('Diária')}
                {subs && <small className={styles.finSub}>{subs}</small>}
                {g.saz && <small className={styles.finSub}>{tr('Sazonalidade aplicada: {{saz}}', { saz: g.saz })}</small>}
              </span>
              <b>{fmtBRL(g.valor * g.qtd)}</b>
            </div>
          );
        })}
        {adj && !isDiariaAdj && Math.abs(diff) >= 0.005 && (
          <div className={styles.finLinha}><span>{describeAdjustment(adj)}</span><b>{diff > 0 ? '+' : ''}{fmtBRL(diff)}</b></div>
        )}
        <hr className={styles.finSep} />
        <div className={[styles.finLinha, styles.finTotal].join(' ')}><span>{tr('Total')}</span><b>{fmtBRL(total)}</b></div>
        {pago > 0.005 && (
          <div className={[styles.finLinha, styles.finPago].join(' ')}><span>{tr('Pago')}</span><b>{fmtBRL(pago)}</b></div>
        )}
        {total > 0 && (
          <div className={styles.finProg}>
            <div className={styles.finProgBarra}><span style={{ width: `${pct}%` }} /></div>
            <div className={styles.finProgLeg}><span>{pct}%</span><span>{tr('Total de {{total}}', { total: fmtBRL(total) })}</span></div>
          </div>
        )}
        {quitado ? (
          <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
        ) : pend > 0.005 && (
          <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(pend)}</b></div>
        )}
        <div className={styles.finAcaoRodape}>
          <button type="button" className={styles.rvSecBtn} disabled={calcLoading} onClick={onPagar}>
            {tr('+ Adicionar pagamento')}
          </button>
        </div>
      </aside>
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanPags = (pags) => pags.map(({ _localId, _criadoEm, ...pg }) => pg);

      if (isSolicitacao) {
        // ── POST /reserva/solicitar — sem PDF ─────────────────────────────────
        const isoToBrLocal = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s);

        const buildSolBody = (quartoId, ci, co, hospedesOrc, obs, periodoIdx) => {
          const valorTotal = precosCalc[`${quartoId}_${periodoIdx}`]?.valor_total;
          const ct = roomCatTimes(quartoId);
          return {
            quarto_id:          parseInt(quartoId),
            status:             'RESERVA_SOLICITADA',
            data_hora_checkin:  `${toBrDate(ci)} ${ct.checkin}`,
            data_hora_checkout: `${toBrDate(co)} ${ct.checkout}`,
            pessoas_orcamento:  hospedesOrc.map((h) => ({
              nome: h.nome,
              ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
            })),
            ...(obs?.trim() ? { observacao: obs.trim() } : {}),
            ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
          };
        };

        if (periodoMode === 'multiplos') {
          for (const [pi, p] of periodos.entries()) {
            const ci = formatDate(p.checkin);
            const co = formatDate(p.checkout);
            for (const q of p.rooms) {
              await reservaApi.solicitar(buildSolBody(q, ci, co, p.roomHospedesOrc?.[q] || [], quartosObs[`${q}_${pi}`], pi));
            }
          }
        } else {
          for (const q of quartos) {
            await reservaApi.solicitar(buildSolBody(q, checkinStr, checkoutStr, quartoHospedesOrc[q] || [], quartosObs[`${q}_0`], 0));
          }
        }
        await onSave?.({ _isSolicitacao: true });
        return;
      }

      if (isOrcamento) {
        // ── Novo endpoint POST /orcamento ─────────────────────────────────────
        const isoToBrLocal = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s);

        const buildHospedagem = (quartoId, dataEntrada, dataSaida, periodoIdx, registeredGuests = [], orcGuests = []) => {
          const valorTotal = precosCalc[`${quartoId}_${periodoIdx}`]?.valor_total ?? undefined;
          const obs = quartosObs[`${quartoId}_${periodoIdx}`]?.trim();
          // Pessoas para orçamento: sem cadastro usa orcGuests, com cadastro usa nomes dos hospedes registrados
          const pessoasOrc = isOrcSemCadastro
            ? orcGuests.map((h) => ({
                nome: h.nome,
                ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
              }))
            : registeredGuests.map((h) => ({
                nome: h.nome,
                ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
              }));
          const ct = roomCatTimes(quartoId);
          return {
            quarto_id:         parseInt(quartoId),
            status:            'ORCAMENTO',
            data_hora_checkin:  `${toBrDate(dataEntrada)} ${ct.checkin}`,
            data_hora_checkout: `${toBrDate(dataSaida)} ${ct.checkout}`,
            pessoas_orcamento:  pessoasOrc,
            ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
            ...(obs ? { observacao: obs } : {}),
          };
        };

        const displayPeriodos = periodoMode === 'unico'
          ? [{ rooms: quartos, checkin: checkinStr, checkout: checkoutStr, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
          : periodos.map((p) => ({ ...p, checkin: formatDate(p.checkin), checkout: formatDate(p.checkout) }));

        let hospedagensBody;
        if (periodoMode === 'multiplos') {
          hospedagensBody = periodos.flatMap((p, pi) =>
            p.rooms.map((q) => buildHospedagem(q, formatDate(p.checkin), formatDate(p.checkout), pi, p.roomHospedes?.[q] || [], p.roomHospedesOrc?.[q] || []))
          );
        } else {
          hospedagensBody = quartos.map((q) => buildHospedagem(q, checkinStr, checkoutStr, 0, quartoHospedes[q] || [], quartoHospedesOrc[q] || []));
        }

        // Chama orcamentoApi.criar diretamente
        const result = await orcamentoApi.criar({
          nome_solicitante: nomeSolicitante.trim(),
          hospedagens:      hospedagensBody,
        });

        // Gera PDF do orçamento
        const _user = userStorage.get();
        const _userName = _user?.pessoa?.nome ?? _user?.nome ?? '';
        gerarVoucherReserva({
          tipo, periodoMode, displayPeriodos, precosCalc, quartosObs, roomDescMap,
          userName: _userName,
          solicitante: { nome: nomeSolicitante.trim() },
          isOrcamento: true,
        });

        // Notifica o componente pai para atualizar o estado com o resultado
        await onSave({ _isOrcamento: true, orcamento: result });
        return;
      }

      // ── PUT /reserva/ativar — nova reserva ativa ─────────────────────────────
      // includePagamentos=false when pagModo==='unico' and this is not the first body;
      // the backend links the first body's payment to all others via pagamentoUnico.
      const buildReservaBody = (quartoId, dataEntrada, dataSaida, hospedes, periodoIdx, includePagamentos = true) => {
        const rKey = `${quartoId}_${periodoIdx}`;
        const roomPags = includePagamentos
          ? (pagModo === 'unico' ? cleanPags(pagUnico) : cleanPags(quartosPag[rKey] || []))
          : [];
        const valorTotal = precosCalc[rKey]?.valor_total ?? undefined;
        const pessoasIds = (hospedes || [])
          .filter((h) => h.id && !String(h.id).startsWith('tmp-'))
          .map((h) => parseInt(h.id));
        const novoPreco = buildNovoPreco(rKey);
        const empresaId = (hospedes || []).find((h) => h._empresa?.id)?._empresa.id ?? null;
        const ct = roomCatTimes(quartoId);
        // Quando há meia diária encerrando no dia do check-in, usa a hora definida pelo funcionário.
        const ciHora = (periodoMode === 'unico' && halfDailyMinCheckin && checkinHour) ? checkinHour : ct.checkin;
        // Meia diária: vai só a hora de saída. O checkout da hospedagem segue com a hora da
        // categoria — é o back-end que monta a diária extra e reajusta o período depois.
        const horaMeia = (periodoMode === 'unico' && meiaDiaria && horaSaidaMeia > ct.checkout)
          ? horaSaidaMeia
          : null;
        return {
          quarto_id:          parseInt(quartoId),
          status:             forcePernoite ? 'PERNOITE_ATIVO' : 'RESERVA_ATIVA',
          data_hora_checkin:  `${toBrDate(dataEntrada)} ${ciHora}`,
          data_hora_checkout: `${toBrDate(dataSaida)} ${ct.checkout}`,
          ...(horaMeia ? { hora_saida_meia_diaria: horaMeia } : {}),
          ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
          ...(pessoasIds.length ? { pessoas: pessoasIds } : {}),
          ...(roomPags.length   ? { pagamentos: roomPags } : {}),
          ...(quartosObs[rKey]?.trim() ? { observacao: quartosObs[rKey].trim() } : {}),
          ...(novoPreco ? { novo_preco: novoPreco } : {}),
          ...(grupoVinculado != null ? { grupo_id: grupoVinculado } : {}),
          ...(grupoResponsavel.trim() ? { grupo_descricao: grupoResponsavel.trim() } : {}),
          ...(empresaId ? { empresa_id: empresaId } : {}),
        };
      };

      // Meia diária no dia do check-in: exige hora de entrada e não pode ser antes do término dela.
      if (halfDailyMinCheckin && (!checkinHour || checkinHour < halfDailyMinCheckin)) {
        onNotify?.(tr('A hora de check-in deve ser após o término da meia diária ({{halfDailyMinCheckin}}).', { halfDailyMinCheckin }), 'error');
        setSaving(false);
        return;
      }

      const allBodies = [];
      if (periodoMode === 'multiplos') {
        for (const [pi, p] of periodos.entries()) {
          const ci = formatDate(p.checkin);
          const co = formatDate(p.checkout);
          for (const q of p.rooms) {
            // pagamentoUnico: only the very first body globally carries pagamentos
            allBodies.push(buildReservaBody(q, ci, co, p.roomHospedes?.[q] || [], pi, pagModo !== 'unico' || allBodies.length === 0));
          }
        }
      } else {
        for (const [qi, q] of quartos.entries()) {
          allBodies.push(buildReservaBody(q, checkinStr, checkoutStr, quartoHospedes[q] || [], 0, pagModo !== 'unico' || qi === 0));
        }
      }
      const res = forcePernoite
        ? await hospedagemApi.criarPernoite(allBodies, pagModo === 'unico' ? true : null)
        : await reservaApi.criarAtiva(allBodies, pagModo === 'unico' ? true : null);
      const allResults = Array.isArray(res) ? res : (res ? [res] : []);
      await onSave(forcePernoite ? { _isPernoite: true, results: allResults.filter(Boolean) } : { _isReserva: true, results: allResults.filter(Boolean) });
    } catch (e) {
      onNotify?.(e?.message || tr('Erro ao salvar reserva.'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <JanelaGaveta open onClose={onClose} size="lg" criando={saving}
      criandoTxt={forceOrcamento ? tr('Criando orçamento…') : isSolicitacao ? tr('Criando solicitação…') : tr('Criando reserva…')}
      bodyStyle={{ padding: '16px 22px' }}
      title={<><Plus size={15} /> {forcePernoite ? tr('Novo Pernoite') : isSolicitacao ? tr('Nova Solicitação') : forceOrcamento ? tr('Novo Orçamento') : tr('Nova Reserva')}</>}
      footer={
        <div className={styles.footerRight}>
          <div className={styles.footerRight}>
            {step > 1 && <Button variant="secondary" onClick={() => { setStep((s) => s - 1); if (step === SUMMARY_STEP) { setPrecosCalc({}); setObsOpen({}); setPriceAdj({}); setAdjModalKey(null); } }}>{tr('Voltar')}</Button>}
            {step < STEPS.length ? (
              <Button variant="primary"
                disabled={
                  (step === 1 && !isSolicitacao && forceOrcamento && !nomeSolicitante.trim()) ||
                  (step === DADOS_STEP && !canNext2)
                }
                onClick={step === SUMMARY_STEP - 1 ? handleGoToResumo : () => setStep((s) => s + 1)}>
                {tr('Próximo')}
              </Button>
            ) : (
              <Button variant="primary" disabled={saving || calcLoading || (!isSolicitacao && !canNext2) || faltaResponsavel}
                title={faltaResponsavel ? tr('Informe o responsável pelo grupo') : undefined} onClick={handleSave}>
                {saving && <Loader2 size={13} className={styles.spin} />}
                {forcePernoite ? tr('Criar Pernoite') : isSolicitacao ? tr('Criar Solicitação') : forceOrcamento ? tr('Gerar Orçamento') : tr('Criar Reserva')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Step bar */}
      <div className={styles.stepBar}>
        {STEPS.map((s, i) => (
          <div key={i} className={[styles.stepItem, step === i + 1 ? styles.stepActive : '', step > i + 1 ? styles.stepDone : ''].join(' ')}>
            <div className={styles.stepDot}>{step > i + 1 ? '✓' : i + 1}</div>
            <span className={styles.stepLabel}>{s}</span>
          </div>
        ))}
      </div>


      {/* ── Tipo / Modo — abaixo das abas, acima do período ── */}
      {step === SUMMARY_STEP && (
        <div style={{ padding: '10px 0 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div className={styles.summaryKv}>
            <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Tipo')}</span><span className={styles.kvVal}>{tipo === 'grupo' ? tr('Vários Apartamentos') : tr('Apartamento Único')}{isSolicitacao ? tr(' · Solicitação') : isOrcamento ? tr(' · Orçamento') : ''}</span></div>
            <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Modo')}</span><span className={styles.kvVal}>{periodoMode === 'unico' ? tr('Período único') : tr('Múltiplos períodos')}</span></div>
            {hasPagStep && (
              <div className={styles.kvRow}><span className={styles.kvLabel}>{tr('Pagamento')}</span><span className={styles.kvVal}>{pagModo === 'unico' ? tr('Pagamento único') : tr('Pagamento por quarto')}</span></div>
            )}
          </div>
        </div>
      )}

      {/* ── Step content (scrollable) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

      {/* ── Step 1: Tipo ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.formStack}>
          <div className={styles.choiceCards}>
              {[
                {
                  v: 'simples',
                  titulo: tr('Apartamento Único'),
                  desc: tr('Um apartamento, um período e uma lista de hóspedes. É a opção do dia a dia, para a reserva de uma família ou de um hóspede só.'),
                },
                {
                  v: 'grupo',
                  titulo: tr('Vários Apartamentos'),
                  desc: tr('Vários apartamentos na mesma reserva, com hóspedes por quarto. Permite períodos diferentes para cada grupo de apartamentos e voucher do grupo inteiro.'),
                },
              ].map((o) => (
                <div key={o.v}
                  className={[styles.choiceCard, tipo === o.v ? styles.choiceCardOn : ''].join(' ')}
                  onClick={() => { setTipo(o.v); if (o.v !== 'grupo') { setPeriodoMode('unico'); setPagModo('por_quarto'); } if (o.v !== 'grupo' && !isSolicitacao) setQuartos((q) => q.slice(0, 1)); }}>
                  <div className={[styles.pagModoCheckBox, tipo === o.v ? styles.pagModoCheckBoxOn : ''].join(' ')}>
                    {tipo === o.v && <Check size={11} />}
                  </div>
                  <div className={styles.choiceCardText}>
                    <div className={styles.choiceCardTitle}>{o.titulo}</div>
                    <div className={styles.choiceCardDesc}>{o.desc}</div>
                  </div>
                </div>
              ))}
          </div>
          {forceOrcamento && (
            <FormField label={tr('Nome do Solicitante')}>
              <input
                className={styles.formInput}
                type="text"
                placeholder={tr('Ex: JOÃO SILVA')}
                value={nomeSolicitante}
                onChange={(e) => setNomeSolicitante(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
                autoFocus
              />
            </FormField>
          )}
        </div>
      )}

      {/* ── Modo de Período (só para vários apartamentos) ─────────────────── */}
      {hasPeriodoStep && step === PERIODO_STEP && (
        <div className={styles.formStack}>
          <div className={styles.choiceCards}>
            {[
              {
                v: 'unico',
                titulo: tr('Período Único'),
                desc: tr('Todos os apartamentos entram e saem nas mesmas datas. Você escolhe o check-in, o check-out e depois os quartos com seus hóspedes.'),
              },
              {
                v: 'multiplos',
                titulo: tr('Múltiplos Períodos'),
                desc: tr('Cada grupo de apartamentos tem suas próprias datas. Você monta um período por vez — datas, quartos e hóspedes — e vai adicionando à reserva.'),
              },
            ].map((o) => (
              <div key={o.v}
                className={[styles.choiceCard, periodoMode === o.v ? styles.choiceCardOn : ''].join(' ')}
                onClick={() => setPeriodoMode(o.v)}>
                <div className={[styles.pagModoCheckBox, periodoMode === o.v ? styles.pagModoCheckBoxOn : ''].join(' ')}>
                  {periodoMode === o.v && <Check size={11} />}
                </div>
                <div className={styles.choiceCardText}>
                  <div className={styles.choiceCardTitle}>{o.titulo}</div>
                  <div className={styles.choiceCardDesc}>{o.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Período & Hóspedes (solicitação) ─────────────────────────────── */}
      {step === DADOS_STEP && isSolicitacao && (
        <div className={styles.formStack}>
          {/* ── Período único ── */}
          {periodoMode === 'unico' && (
            <>
              <div className={styles.step2Grid}>
                <FormField label={<>{tr('Check-in')}{checkinStr && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>{fmtDateBR(checkinStr)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker sobrio mode="single" value={checkin}
                      onChange={(d) => {
                        setCheckin(d);
                        setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({});
                        if (checkout && d && checkout <= d) setCheckout(null);
                      }}
                      placeholder={tr('Data de check-in')} minDate={new Date()} />
                  </div>
                </FormField>
                <FormField label={<>{tr('Check-out')}{checkoutStr && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>{fmtDateBR(checkoutStr)}</span>}{checkinStr && checkoutStr && dias > 0 && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>· {diariasTxt(dias)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker sobrio mode="single" value={checkout}
                      onChange={(d) => { setCheckout(d); setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({}); }}
                      placeholder={tr('Data de check-out')}
                      minDate={checkin ? new Date(checkin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                      markedDate={checkin} />
                  </div>
                </FormField>
              </div>
              <FormField label={tipo === 'grupo' ? tr('Apartamentos (múltipla seleção)') : tr('Apartamento')}>
                <RoomCombobox value={quartos}
                  onChange={(v) => { setQuartos(v); setQuartoHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                  availableRooms={availableRooms}
                  categorias={categorias} roomDescMap={roomDescMap}
                  singleSelect={tipo !== 'grupo'}
                  disabled={!checkinStr || !checkoutStr}
                  loading={availLoading} />
              </FormField>
              {quartos.map((q) => (
                <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div className={styles.kvSectionDivider} style={{ margin: 0 }}>
                    {tr('Hóspedes')}{quartos.length > 1 ? tr(' — Apartamento {{v0}}', { v0: fmtRoom(parseInt(q)) }) : ''}
                    <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 11, marginLeft: 8 }}>{tr('· 1º hóspede = solicitante')}</span>
                  </div>
                  <SemCadastroHospedesPicker
                    value={quartoHospedesOrc[q] || []}
                    onChange={(v) => setQuartoHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                    onDraftChange={setSemCadastroDraft} />
                </div>
              ))}
            </>
          )}

          {/* ── Múltiplos períodos ── */}
          {periodoMode === 'multiplos' && (
            <>
              {periodos.length > 0 && (
                <div className={styles.periodosList}>
                  {periodos.map((p, i) => {
                    const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
                    const isEditing = editingPeriodoIdx === i;
                    return (
                      <div key={i} className={[styles.periodoItem, isEditing ? styles.periodoItemEditing : ''].join(' ')}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemTit}>{tr('Período')} {i + 1}</span>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                          <div className={styles.periodoQuartos}>
                            {p.rooms.map((q) => {
                              const hosp = p.roomHospedesOrc?.[q] || [];
                              return (
                                <div key={q} className={styles.periodoQuarto}>
                                  <span className={styles.periodoItemRoomNum}>{fmtRoom(parseInt(q))}</span>
                                  <span className={styles.periodoNomes}>
                                  {hosp.length > 0
                                    ? hosp.map((h, hi) => (
                                        <span key={hi} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 400 }}>
                                          {h.nome}
                                        </span>
                                      ))
                                    : <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{tr('sem hóspedes')}</span>
                                  }
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className={styles.periodoItemAcoes}>
                          {isEditing ? <span className={styles.periodoItemEditando}>{tr('Editando')}</span> : (
                            <button type="button" className={styles.rvSecBtn} onClick={() => startEditPeriodo(i)}>{tr('Editar')}</button>
                          )}
                          <button type="button" className={[styles.rvSecBtn, styles.rvSecBtnPerigo].join(' ')}
                            onClick={() => { if (isEditing) resetMpForm(); setPeriodos((ps) => ps.filter((_, j) => j !== i)); }}>
                            {tr('Remover')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.mpForm}>
                <div className={styles.step2Grid}>
                  <FormField label={tr('Check-in')}>
                    <div className={styles.dateCompact}>
                      <DatePicker sobrio mode="single" value={mpCheckin}
                        onChange={(d) => {
                          setMpCheckin(d);
                          setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({});
                          if (mpCheckout && d && mpCheckout <= d) setMpCheckout(null);
                        }}
                        placeholder={tr('Data de check-in')} minDate={new Date()} />
                    </div>
                  </FormField>
                  <FormField label={tr('Check-out')}>
                    <div className={styles.dateCompact}>
                      <DatePicker sobrio mode="single" value={mpCheckout}
                        onChange={(d) => { setMpCheckout(d); setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({}); }}
                        placeholder={tr('Data de check-out')}
                        minDate={mpCheckin ? new Date(mpCheckin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                        markedDate={mpCheckin} />
                    </div>
                  </FormField>
                </div>
                <FormField label={tr('Apartamentos para este período')}>
                  <RoomCombobox value={mpRooms}
                    onChange={(v) => { setMpRooms(v); setMpRoomHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                    availableRooms={mpAvailableRooms} categorias={categorias} roomDescMap={roomDescMap}
                    disabled={!mpCheckin || !mpCheckout}
                    loading={mpAvailLoading} />
                </FormField>
                {mpRooms.map((q) => (
                  <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>
                      {tr('Hóspedes')}{mpRooms.length > 1 ? tr(' — Apartamento {{v0}}', { v0: fmtRoom(parseInt(q)) }) : ''}
                      <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 11, marginLeft: 8 }}>{tr('· 1º hóspede = solicitante')}</span>
                    </div>
                    <SemCadastroHospedesPicker
                      value={mpRoomHospedesOrc[q] || []}
                      onChange={(v) => setMpRoomHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                      onDraftChange={setSemCadastroDraft} />
                  </div>
                ))}
                <div className={styles.mpAcoes}>
                  {editingPeriodoIdx !== null && (
                    <Button variant="secondary" onClick={resetMpForm}>{tr('Cancelar')}</Button>
                  )}
                  <Button variant="primary"
                    disabled={!mpRooms.length || !mpCheckin || !mpCheckout || mpRooms.some((q) => !(mpRoomHospedesOrc[q]?.length > 0))}
                    onClick={addPeriodo}>
                    {editingPeriodoIdx !== null ? <><Check size={13} /> {tr('Salvar Alterações')}</> : <><Plus size={13} /> {tr('Adicionar Período')}</>}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Quarto & Período ───────────────────────────────────────── */}
      {step === DADOS_STEP && !isSolicitacao && (
        <div className={styles.formStack}>
          {/* Vincular esta(s) reserva(s) a um grupo já existente (opcional).
              Aberto pelo painel de grupos, o grupo já vem definido e não muda. */}
          {!isOrcamento && gruposExistentes.length > 0 && (
            <FormField label={<><Users size={13} /> {initialGrupo != null ? tr('Grupo da reserva') : tr('Vincular a grupo existente (opcional)')}</>}>
              <select
                className={styles.formInput}
                value={grupoVinculado ?? ''}
                disabled={initialGrupo != null}
                title={initialGrupo != null ? tr('Reserva iniciada pelo painel do grupo') : undefined}
                onChange={(e) => setGrupoVinculado(e.target.value ? Number(e.target.value) : null)}
              >
                {initialGrupo == null && <option value="">{tr('Não vincular a nenhum grupo')}</option>}
                {gruposExistentes.map((g) => (
                  <option key={g.grupo_id} value={g.grupo_id}>
                    {g.descricao || (g.titulares || '').split(',')[0].trim() || `Grupo #${g.grupo_id}`} · #{g.grupo_id} ({g.count} {tr('apto')}{g.count !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {periodoMode === 'unico' && (
            <>
              <div className={styles.step2Grid}>
                {/* Pernoite: check-in travado em hoje (só leitura). */}
                <FormField label={tr('Check-in')}>
                  <div className={styles.dateCompact}>
                    <DatePicker sobrio mode="single" value={checkin}
                      readOnly={forcePernoite}
                      onChange={forcePernoite ? undefined : (d) => {
                        setCheckin(d);
                        setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({});
                        // check-out anterior/igual ao novo check-in deixa de ser válido
                        if (checkout && d && checkout <= d) setCheckout(null);
                      }}
                      placeholder={tr('Data de check-in')} minDate={new Date()} />
                  </div>
                </FormField>
                <FormField label={<>{tr('Check-out')}{checkinStr && checkoutStr && dias > 0 && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>· {diariasTxt(dias)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker sobrio mode="single" value={checkout}
                      onChange={(d) => {
                        if (forcePernoite) setCheckin(new Date());
                        setCheckout(d); setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({});
                        setMeiaDiaria(false); setHoraSaidaMeia('');
                      }}
                      placeholder={checkin ? tr('Data de check-out') : tr('Defina o check-in primeiro')}
                      disabled={!checkin}
                      minDate={checkin ? new Date(checkin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                      markedDate={checkin} />
                  </div>
                  {/* Meia diária: marcar abre a hora de saída. Só aparece com apartamento
                      escolhido, que é de onde vem o checkout da categoria a comparar. */}
                  {checkout && quartos.length > 0 && !isOrcamento && (
                    <div className={styles.meiaDiariaBox}>
                      <label className={styles.empresaModeToggle}>
                        <input type="checkbox" checked={meiaDiaria}
                          onChange={(e) => {
                            setMeiaDiaria(e.target.checked);
                            if (!e.target.checked) setHoraSaidaMeia('');
                          }} />
                        <span>{tr('Meia diária')}</span>
                      </label>
                      {meiaDiaria && (
                        <div className={styles.meiaDiariaRow}>
                          <span className={styles.meiaDiariaLabel}>{tr('Hora de saída')}</span>
                          <div className={styles.meiaDiariaInput}>
                            <TimePicker value={horaSaidaMeia} onChange={setHoraSaidaMeia} />
                          </div>
                          <span className={temMeiaDiaria ? styles.meiaDiariaAviso : styles.meiaDiariaHint}>
                            {temMeiaDiaria
                              ? tr('Meio valor da diária de {{v0}}', { v0: fmtDateBR(checkoutStr) })
                              : tr('Informe uma hora após o checkout da categoria ({{checkoutCatHora}})', { checkoutCatHora })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
              </div>
              <FormField label={tipo === 'grupo' ? tr('Apartamentos (múltipla seleção)') : tr('Apartamento')}>
                <RoomCombobox value={quartos}
                  onChange={(v) => { setQuartos(v); setQuartoHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                  availableRooms={availableRooms}
                  categorias={categorias} roomDescMap={roomDescMap}
                  singleSelect={tipo !== 'grupo'}
                  disabled={!checkinStr || !checkoutStr}
                  loading={availLoading} />
              </FormField>
              {/* Per-room hospedes */}
              {quartos.map((q) => (
                <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {tipo === 'grupo' && (
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>{tr('Apartamento')} {fmtRoom(parseInt(q))}</div>
                  )}
                  {isOrcSemCadastro ? (
                    <SemCadastroHospedesPicker
                      value={quartoHospedesOrc[q] || []}
                      onChange={(v) => setQuartoHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                      onDraftChange={setSemCadastroDraft} />
                  ) : (
                    <RoomHospedesPicker
                      value={quartoHospedes[q] || []}
                      onChange={(v) => setQuartoHospedes((prev) => ({ ...prev, [q]: v }))} />
                  )}
                </div>
              ))}
              {halfDailyMinCheckin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <div className={styles.avisoBox}>
                    <span className={styles.avisoBoxIcon}><AlertTriangle size={16} /></span>
                    <div className={styles.avisoBoxBody}>
                      <span className={styles.avisoBoxTitle}>
                        {tr('Hora de check-in (meia diária anterior)')}
                      </span>
                      <p className={styles.avisoBoxText}>
                        {tr('Há uma meia diária encerrando às')} <b>{halfDailyMinCheckin}</b> {tr('no dia do check-in. Defina a hora de entrada — não pode ser anterior a esse horário.')}
                      </p>
                      <div style={{ maxWidth: 150 }}>
                        <TimePicker value={checkinHour} onChange={setCheckinHour} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {periodoMode === 'multiplos' && (
            <>
              {periodos.length > 0 && (
                <div className={styles.periodosList}>
                  {periodos.map((p, i) => {
                    const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
                    const isEditing = editingPeriodoIdx === i;
                    return (
                      <div key={i} className={[styles.periodoItem, isEditing ? styles.periodoItemEditing : ''].join(' ')}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemTit}>{tr('Período')} {i + 1}</span>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                          <div className={styles.periodoQuartos}>
                            {p.rooms.map((q) => {
                              const hosp = isOrcSemCadastro ? (p.roomHospedesOrc?.[q] || []) : (p.roomHospedes?.[q] || []);
                              return (
                                <div key={q} className={styles.periodoQuarto}>
                                  <span className={styles.periodoItemRoomNum}>{fmtRoom(parseInt(q))}</span>
                                  <span className={styles.periodoNomes}>
                                  {hosp.length > 0
                                    ? hosp.map((h, hi) => (
                                        <span key={isOrcSemCadastro ? hi : h.id} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 400 }}>
                                          {h.nome}
                                        </span>
                                      ))
                                    : <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{tr('sem hóspedes')}</span>
                                  }
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className={styles.periodoItemAcoes}>
                          {isEditing ? <span className={styles.periodoItemEditando}>{tr('Editando')}</span> : (
                            <button type="button" className={styles.rvSecBtn} onClick={() => startEditPeriodo(i)}>{tr('Editar')}</button>
                          )}
                          <button type="button" className={[styles.rvSecBtn, styles.rvSecBtnPerigo].join(' ')}
                            onClick={() => { if (isEditing) resetMpForm(); setPeriodos((ps) => ps.filter((_, j) => j !== i)); }}>
                            {tr('Remover')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.mpForm}>
                <div className={styles.step2Grid}>
                  <FormField label={tr('Check-in')}>
                    <div className={styles.dateCompact}>
                      <DatePicker sobrio mode="single" value={mpCheckin}
                        onChange={(d) => {
                          setMpCheckin(d);
                          setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({});
                          // check-out anterior/igual ao novo check-in deixa de ser válido
                          if (mpCheckout && d && mpCheckout <= d) setMpCheckout(null);
                        }}
                        placeholder={tr('Data de check-in')} minDate={new Date()} />
                    </div>
                  </FormField>
                  <FormField label={<>{tr('Check-out')}{mpCheckin && mpCheckout && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>· {diariasTxt(diffDays(formatDate(mpCheckin), formatDate(mpCheckout)))}</span>}</>}>
                    <div className={styles.dateCompact}>
                      <DatePicker sobrio mode="single" value={mpCheckout}
                        onChange={(d) => { setMpCheckout(d); setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({}); }}
                        placeholder={mpCheckin ? tr('Data de check-out') : tr('Defina o check-in primeiro')}
                        disabled={!mpCheckin}
                        minDate={mpCheckin ? new Date(mpCheckin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                        markedDate={mpCheckin} />
                    </div>
                  </FormField>
                </div>
                <FormField label={tr('Apartamentos para este período')}>
                  <RoomCombobox value={mpRooms}
                    onChange={(v) => { setMpRooms(v); setMpRoomHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                    availableRooms={mpAvailableRooms} categorias={categorias} roomDescMap={roomDescMap}
                    disabled={!mpCheckin || !mpCheckout}
                    loading={mpAvailLoading} />
                </FormField>
                {/* Per-room hospedes for this period */}
                {mpRooms.map((q) => (
                  <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>{tr('Apartamento')} {fmtRoom(parseInt(q))}{roomDescMap[q] ? ` — ${roomDescMap[q]}` : ''}</div>
                    {isOrcSemCadastro ? (
                      <SemCadastroHospedesPicker
                        value={mpRoomHospedesOrc[q] || []}
                        onChange={(v) => setMpRoomHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                        onDraftChange={setSemCadastroDraft} />
                    ) : (
                      <RoomHospedesPicker
                        value={mpRoomHospedes[q] || []}
                        onChange={(v) => setMpRoomHospedes((prev) => ({ ...prev, [q]: v }))} />
                    )}
                  </div>
                ))}
                <div className={styles.mpAcoes}>
                  {editingPeriodoIdx !== null && (
                    <Button variant="secondary" onClick={resetMpForm}>{tr('Cancelar')}</Button>
                  )}
                  <Button variant="primary" disabled={!mpRooms.length || !mpCheckin || !mpCheckout || mpRooms.some((q) => isOrcSemCadastro ? !(mpRoomHospedesOrc[q]?.length > 0) : !(mpRoomHospedes[q]?.length > 0))} onClick={addPeriodo}>
                    {editingPeriodoIdx !== null ? <><Check size={13} /> {tr('Salvar Alterações')}</> : <><Plus size={13} /> {tr('Adicionar Período')}</>}
                  </Button>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── Step 3: Modo de Pagamento ─────────────────────────────────────── */}
      {hasPagStep && step === PAG_STEP && (
        <div className={styles.formStack}>
          <FormField label={tr('Como o pagamento será registrado?')}>
            <div className={styles.choiceCards}>
              {[
                {
                  v: 'por_quarto',
                  titulo: tr('Pagamento por quarto'),
                  desc: tr('Cada apartamento tem seus próprios pagamentos e seu próprio saldo. Use quando os hóspedes pagam separadamente — cada quarto recebe o seu voucher e a sua cobrança.'),
                },
                {
                  v: 'unico',
                  titulo: tr('Pagamento único'),
                  desc: tr('Um só pagamento cobre todos os apartamentos da reserva. Use quando um responsável paga a conta inteira — o valor é lançado uma vez e abatido do total do grupo.'),
                },
              ].map((o) => (
                <div key={o.v}
                  className={[styles.choiceCard, pagModo === o.v ? styles.choiceCardOn : ''].join(' ')}
                  onClick={() => setPagModo(o.v)}>
                  <div className={[styles.pagModoCheckBox, pagModo === o.v ? styles.pagModoCheckBoxOn : ''].join(' ')}>
                    {pagModo === o.v && <Check size={11} />}
                  </div>
                  <div className={styles.choiceCardText}>
                    <div className={styles.choiceCardTitle}>{o.titulo}</div>
                    <div className={styles.choiceCardDesc}>{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </FormField>
        </div>
      )}

      {/* ── Resumo & Pagamentos ───────────────────────────────────────────── */}
      {step === SUMMARY_STEP && (() => {
        // Build the periods list for display
        const displayPeriodos = periodoMode === 'unico'
          ? [{ rooms: quartos, checkin, checkout, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
          : periodos;


        // Financial totals
        const grandTotal   = Object.values(precosCalc).reduce((s, c) => s + (c?.valor_total ?? 0), 0);
        const formaDoPag   = (p) => p.formaPagamento ?? p.tipo_pagamento?.descricao
          ?? tiposPagamento.find((t) => t.id === p.tipo_pagamento?.id)?.descricao;
        const totalPago    = (pagModo === 'unico' ? pagUnico : Object.values(quartosPag).flat())
          .filter((p) => !isPagamentoPendente(formaDoPag(p)))
          .reduce((s, p) => s + (p.valor ?? 0), 0);
        const pendente     = Math.max(0, grandTotal - totalPago);
        // Pagamento por quarto → valores e pagamentos vivem no card de cada apartamento.
        // Pagamento único / orçamento / solicitação → um card de totais no topo.
        const perRoomPag = !isOrcamento && !isSolicitacao && pagModo === 'por_quarto';
        const totalAptos = displayPeriodos.reduce((s, p) => s + (p.rooms?.length ?? 0), 0);

        return (
          <div className={styles.step3Root}>

            {/* ── Modal de ajuste de preço (Gerenciar Preços) ── */}
            {adjModalKey && precosCalc[adjModalKey] && (() => {
              const { baseTotal, baseDiarias } = baseForKey(adjModalKey);
              const key = adjModalKey;
              return (
                <PriceAdjustmentModal
                  open
                  as={GavetaLado}
                  title={<><Tag size={15} /> {tr('Desconto')} · {tr('Apartamento')} {fmtRoom(parseInt(String(key).split('_')[0]))}</>}
                  onClose={() => setAdjModalKey(null)}
                  baseTotal={baseTotal}
                  baseDiarias={baseDiarias}
                  initial={priceAdj[key]}
                  onApply={(result, raw) => {
                    setPriceAdj((prev) => ({ ...prev, [key]: raw }));
                    setPrecosCalc((prev) => (prev[key]
                      ? { ...prev, [key]: { ...prev[key], valor_total: result.valorTotal } }
                      : prev));
                    // Registra/atualiza a alteração de valor na observação do apartamento.
                    setQuartosObs((prev) => {
                      const atual = prev[key] || '';
                      const semNota = atual
                        .split('\n')
                        .filter((l) => !l.trim().startsWith(ADJ_OBS_PREFIX))
                        .join('\n')
                        .trim();
                      const mudou = Math.abs(result.valorTotal - baseTotal) >= 0.005;
                      if (!mudou) return { ...prev, [key]: semNota };
                      const nota = `${ADJ_OBS_PREFIX} ${describeAdjustment(raw)} (novo total ${fmtBRL(result.valorTotal)})`;
                      return { ...prev, [key]: semNota ? `${semNota}\n${nota}` : nota };
                    });
                  }}
                />
              );
            })()}

            {/* ── Card de totais da reserva — some quando os valores são por apartamento.
                   Pagamentos, valor de cada apartamento e totais na mesma lista. ── */}
            {!perRoomPag && (() => {
              const quitado = grandTotal > 0 && totalPago >= grandTotal - 0.005;
              const pct     = grandTotal > 0 ? Math.min(100, Math.round((totalPago / grandTotal) * 100)) : 0;
              const comPag  = !isOrcamento && !isSolicitacao;
              return (
              <aside className={[styles.finResumo, styles.finResumoView, styles.finResumoCriar].join(' ')}>
                <div className={[styles.finCab, styles.finCabAcao].join(' ')}>
                  <h4 className={styles.finTit}>
                    {isOrcamento ? tr('Orçamento') : isSolicitacao ? tr('Solicitação') : tr('Resumo financeiro')}
                  </h4>
                  {comPag && totalAptos <= 1 && (
                    <button type="button" className={[styles.rvSecBtn, styles.finCabSec].join(' ')} disabled={calcLoading} onClick={() => setShowPagModal(true)}>
                      {tr('+ Registrar pagamento')}
                    </button>
                  )}
                </div>

                {/* Responsável do grupo (obrigatório) — identifica o grupo na lista e ao
                    vincular novas reservas. O registro de pagamento fica ao lado dele. */}
                {totalAptos > 1 && comPag && (
                  <div className={styles.respLinha}>
                    <FormField label={tr('Responsável pelo grupo *')}>
                      <Input placeholder={tr('Nome de quem responde pelo grupo')}
                        value={grupoResponsavel}
                        onChange={(e) => setGrupoResponsavel(e.target.value.toUpperCase())} />
                    </FormField>
                    <button type="button" className={styles.rvSecBtn} disabled={calcLoading} onClick={() => setShowPagModal(true)}>
                      {tr('+ Registrar pagamento')}
                    </button>
                  </div>
                )}

                {/* Uma linha por apartamento — as diárias ficam no card de cada um */}
                {displayPeriodos.flatMap((p, pi) => p.rooms.map((q) => {
                  const rKey = `${q}_${pi}`;
                  return (
                    <div key={rKey} className={styles.finLinha}>
                      <span className={styles.finLinhaTxt}>
                        {tr('Apartamento')} {fmtRoom(parseInt(q))}
                      </span>
                      <b>
                        {calcLoading && !precosCalc[rKey]
                          ? <span className={styles.sk} style={{ width: 72, display: 'inline-block' }} />
                          : fmtBRL(precosCalc[rKey]?.valor_total ?? 0)}
                      </b>
                    </div>
                  );
                }))}

                <hr className={styles.finSep} />
                <div className={[styles.finLinha, styles.finTotal].join(' ')}>
                  <span>{tr('Total')}</span>
                  <b>{calcLoading ? <span className={styles.sk} style={{ width: 90, height: 16, display: 'inline-block' }} /> : fmtBRL(grandTotal)}</b>
                </div>

                {comPag && totalPago > 0.005 && (
                  <div className={[styles.finLinha, styles.finPago].join(' ')}><span>{tr('Pago')}</span><b>{fmtBRL(totalPago)}</b></div>
                )}

                {comPag && grandTotal > 0 && (
                  <div className={styles.finProg}>
                    <div className={styles.finProgBarra}><span style={{ width: `${pct}%` }} /></div>
                    <div className={styles.finProgLeg}>
                      <span>{pct}%</span>
                      <span>{tr('Total de {{total}}', { total: fmtBRL(grandTotal) })}</span>
                    </div>
                  </div>
                )}
                {comPag && (quitado ? (
                  <p className={styles.finQuitado}><Check size={15} /> {tr('Pago integralmente')}</p>
                ) : pendente > 0.005 && (
                  <div className={styles.finPendGrande}><span>{tr('Pendente')}</span><b>{fmtBRL(pendente)}</b></div>
                ))}
              </aside>
              );
            })()}

            {perRoomPag && totalAptos > 1 && (
              <div className={styles.respSolo}>
                <FormField label={tr('Responsável pelo grupo *')}>
                  <Input placeholder={tr('Nome de quem responde pelo grupo')}
                    value={grupoResponsavel}
                    onChange={(e) => setGrupoResponsavel(e.target.value.toUpperCase())} />
                </FormField>
              </div>
            )}

            {!perRoomPag && !isOrcamento && !isSolicitacao && pagUnico.length > 0 && (
              <div className={[styles.rcSection, styles.criarPagSec].join(' ')}>
                <div className={styles.rcSectionHead}><span className={styles.rcSectionLabel}>{tr('Pagamentos')}</span></div>
                <TabelaPagamentosCriar lista={pagUnico} tiposPagamento={tiposPagamento}
                  onRemover={(pg) => setPagUnico((prev) => prev.filter((x) => x._localId !== pg._localId))} />
              </div>
            )}

            {/* ── Períodos + quartos + hóspedes ── */}
            {displayPeriodos.map((p, pi) => {
              const ci = p.checkin ? formatDate(p.checkin) : checkinStr;
              const co = p.checkout ? formatDate(p.checkout) : checkoutStr;
              const d2 = ci && co ? diffDays(ci, co) : 0;
              const pPessoas = p.rooms.reduce((acc, q) => acc + (
                ((isOrcSemCadastro ? p.roomHospedesOrc : p.roomHospedes) || {})[q]?.length ?? 0
              ), 0);
              return (
                <div key={pi} className={styles.step3PeriodoBlock}>
                  {/* Período + seus apartamentos no mesmo card; o cabeçalho fica fixo no topo */}
                  <div className={styles.step3PeriodoCard}>
                    <div className={styles.step3PeriodoHead}>
                    {periodoMode === 'multiplos' && (
                      <span className={styles.step3PeriodoBandLabel}>{tr('Período')} {pi + 1}</span>
                    )}
                    <div className={styles.rcPeriodRow}>
                      <div className={styles.ovDateCell}>
                        <div className={styles.ovDateLabel}>{tr('Check-in')}</div>
                        <div className={styles.ovDateValue}>{fmtDateBR(ci)}</div>
                      </div>
                      <div className={styles.ovDateArrow}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </div>
                      <div className={[styles.ovDateCell, styles.ovDateCellRight].join(' ')}>
                        <div className={styles.ovDateLabel}>{tr('Check-out')}</div>
                        <div className={styles.ovDateValue}>{fmtDateBR(co)}</div>
                      </div>
                    </div>
                    </div>
                    <div className={styles.step3PeriodoRooms}>
                  {p.rooms.map((q) => {
                    const qHosp    = (p.roomHospedes || {})[q] || [];
                    const qHospOrc = (p.roomHospedesOrc || {})[q] || [];
                    const rKey   = `${q}_${pi}`;
                    const rCalc  = precosCalc[rKey];
                    const rPags  = quartosPag[rKey] || [];
                    // Pago/Pendente deste apartamento (só existem no pagamento por quarto).
                    const rPago = rPags
                      .filter((pg) => !isPagamentoPendente(formaDoPag(pg)))
                      .reduce((s, pg) => s + (pg.valor ?? 0), 0);
                    const rPend = Math.max(0, (rCalc?.valor_total ?? 0) - rPago);
                    // "2 adultos · 1 criança" — repetido em cada linha de diária.
                    const rHosp     = isOrcSemCadastro ? qHospOrc : qHosp;
                    const nAdultos  = rHosp.filter((h) => { const a = calcAge(h.dataNascimento); return a === null || a >= 18; }).length;
                    const nCriancas = rHosp.length - nAdultos;
                    const guestLabel = [
                      nAdultos  ? `${nAdultos} ${nAdultos === 1 ? tr('adulto') : tr('adultos')}`       : '',
                      nCriancas ? `${nCriancas} ${nCriancas === 1 ? tr('criança') : tr('crianças')}`   : '',
                    ].filter(Boolean).join(' · ');
                    // Uma única diária que já vale o total: a linha da diária ("Diária ··· R$ 120,00")
                    // repete o valor, então o "Total" é omitido. Com desconto que muda o total,
                    // mais de uma diária ou qualquer outro valor, o Total volta a aparecer.
                    const detalhesR   = rCalc?.detalhes || [];
                    const adjR        = priceAdj[rKey];
                    const valorUnicoR = detalhesR.length === 1
                      ? (adjR?.mode === 'diaria'
                          ? Math.max(0, Math.round((Number(adjR.value) || 0) * 100) / 100)
                          : (detalhesR[0].valor_final ?? 0))
                      : null;
                    const rTotalCalc    = rCalc?.valor_total ?? 0;
                    // Pagamento único é acerto do grupo: o apartamento só fica verde
                    // quando ele mesmo foi quitado, no modo por quarto.
                    const quartoQuitado = perRoomPag && rTotalCalc > 0 && rPago >= rTotalCalc - 0.005;
                    const totalRedundante = valorUnicoR !== null
                      && Math.abs((rCalc?.valor_total ?? 0) - valorUnicoR) < 0.005;
                    const aberto = !!roomOpen[rKey];
                    return (
                      <div key={q} className={[styles.step3RoomRow, aberto ? styles.step3RoomRowOpen : ''].join(' ')}>

                        {/* Cabeçalho — botão de expandir à esquerda, ações à direita */}
                        <div className={styles.rcHead}>
                          <div className={styles.rcHeadLeft}>
                            <div className={styles.rcHeadTop}>
                              <button type="button" className={styles.rcToggleBtn}
                                title={aberto ? tr('Ocultar detalhes') : tr('Mostrar detalhes')}
                                aria-expanded={aberto}
                                onClick={() => setRoomOpen((prev) => ({ ...prev, [rKey]: !prev[rKey] }))}>
                                <ChevronDown size={16} className={aberto ? styles.rcToggleOpen : undefined} />
                              </button>
                              <span className={styles.rcTitle}>{tr('Apartamento')} {fmtRoom(parseInt(q))}</span>
                            </div>
                          </div>
                          {/* Recolhido: o total do apartamento fica à direita */}
                          {!aberto && rCalc && (
                            <span className={styles.rcHeadTotal}>{fmtBRL(rCalc.valor_total ?? 0)}</span>
                          )}
                          {/* Ações só aparecem com o apartamento expandido */}
                          {aberto && (
                            <div className={styles.rcHeadActions}>
                              <button type="button" className={styles.rvSecBtn}
                                disabled={!rCalc}
                                onClick={() => setAdjModalKey(rKey)}>
                                {priceAdj[rKey] ? tr('Desconto aplicado') : tr('+ Desconto')}
                              </button>
                            </div>
                          )}
                        </div>

                        {aberto && (<>
                        {/* Hóspedes — sem linha antes das diárias */}
                        <div className={[styles.rcSection, styles.rcSectionNoLine].join(' ')}>
                          {(isOrcSemCadastro ? qHospOrc : qHosp).length > 0
                            ? <HospedesResumo lista={isOrcSemCadastro ? qHospOrc : qHosp} rotuloTitular={isSolicitacao ? tr('Solicitante') : tr('Titular')} />
                            : <div className={styles.pagEmpty}>{tr('Sem hóspedes vinculados')}</div>}
                        </div>

                        {/* Diárias — uma linha por diária, sem repetir o detalhamento */}
                        {(rCalc || calcLoading) && (
                          <div className={[styles.rcSection, styles.rcSectionNoLine].join(' ')}>
                            {calcLoading && !rCalc && (
                              <div className={styles.rcSectionLabel}>{tr('Calculando…')}</div>
                            )}

                            {/* Pagamento por apartamento: resumo financeiro do quarto e, abaixo, os pagamentos */}
                            {perRoomPag && rCalc && (<>
                              {renderRoomResumo(rCalc, rKey, guestLabel, rPago, () => { setShowPagModalRoom(rKey); setShowPagModal(true); })}
                              {rPags.length > 0 && (
                                <div className={styles.criarPagQuarto}>
                                  <div className={styles.rcSectionHead}><span className={styles.rcSectionLabel}>{tr('Pagamentos')}</span></div>
                                  <TabelaPagamentosCriar lista={rPags} tiposPagamento={tiposPagamento}
                                    onRemover={(pg) => setQuartosPag((prev) => ({ ...prev, [rKey]: (prev[rKey] || []).filter((x) => x._localId !== pg._localId) }))} />
                                </div>
                              )}
                            </>)}

                            {/* Diárias logo acima dos totais */}
                            {!perRoomPag && rCalc && renderRoomDiarias(rCalc, rKey, guestLabel, quartoQuitado)}

                            {/* Totais. O valor já pago aparece na lista de pagamentos acima,
                                então aqui só Total + Pendente (ou "Total pago" se quitado). */}
                            {!perRoomPag && rCalc && (() => {
                              const rTotal  = rCalc.valor_total ?? 0;
                              const quitado = perRoomPag && rPago > 0 && rPend < 0.005;
                              // Quitado com diária única que vale o total: pagamento + diária já contam tudo.
                              const showQuitado = quitado && !totalRedundante;
                              const showTotal   = !quitado && !totalRedundante;
                              const showPend    = !quitado && perRoomPag;
                              if (!showQuitado && !showTotal && !showPend) return null;
                              return (
                                <div className={styles.rcResumoList}>
                                  {showQuitado && (
                                    <div className={[styles.rcResumoRow, styles.rcResumoGreen].join(' ')}>
                                      <span>{tr('Total pago')}</span><span>{fmtBRL(rPago)}</span>
                                    </div>
                                  )}
                                  {showTotal && (
                                    <div className={styles.rcResumoRow}>
                                      <span>{tr('Total')}</span><span>{fmtBRL(rTotal)}</span>
                                    </div>
                                  )}
                                  {showPend && (
                                    <div className={[styles.rcResumoRow, styles.rcResumoDanger].join(' ')}>
                                      <span>{tr('Pendente')}</span><span>{fmtBRL(rPend)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Observação */}
                        {obsOpen[rKey] || quartosObs[rKey] ? (
                          <div className={styles.rcSection}>
                            <textarea className={styles.obsTextarea} rows={2}
                              placeholder={tr('Observação para este apartamento (opcional)...')}
                              value={quartosObs[rKey] || ''}
                              onChange={(e) => setQuartosObs((prev) => ({ ...prev, [rKey]: e.target.value }))} />
                          </div>
                        ) : (
                          <div className={styles.rcObsToggleLinha}>
                            <button type="button" className={styles.rvSecBtn}
                              onClick={() => setObsOpen((prev) => ({ ...prev, [rKey]: true }))}>
                              {tr('+ Adicionar observação')}
                            </button>
                          </div>
                        )}
                        </>)}
                      </div>
                    );
                  })}
                    </div>{/* end step3PeriodoRooms */}
                  </div>{/* end step3PeriodoCard */}
                </div>
              );
            })}

          </div>
        );
      })()}

      </div>{/* end scrollable step content */}
      </div>{/* end outer flex column */}

      {/* Payment modal */}
      {(() => {
        const grandTotalModal = Object.values(precosCalc).reduce((s, c) => s + (c?.valor_total ?? 0), 0);
        // showPagModalRoom holds the composite rKey `${roomId}_${periodoIdx}` (per-room mode)
        const [roomId, roomPi] = showPagModalRoom != null ? showPagModalRoom.split('_') : [null, null];
        let pagVTotal, pagVPago;
        const formaDoPag = (p) => p.formaPagamento ?? p.tipo_pagamento?.descricao
          ?? tiposPagamento.find((t) => t.id === p.tipo_pagamento?.id)?.descricao;
        const somaPagos = (arr) => arr.filter((p) => !isPagamentoPendente(formaDoPag(p))).reduce((s, p) => s + (p.valor ?? 0), 0);
        if (pagModo === 'unico') {
          pagVTotal = grandTotalModal || null;
          pagVPago  = somaPagos(pagUnico);
        } else {
          pagVTotal = showPagModalRoom != null ? (precosCalc[showPagModalRoom]?.valor_total ?? null) : null;
          pagVPago  = showPagModalRoom != null
            ? somaPagos(quartosPag[showPagModalRoom] || [])
            : null;
        }
        const fecharPagCriar = () => { setShowPagModal(false); setShowPagModalRoom(null); };
        return showPagModal && (
          <GavetaLado onClose={fecharPagCriar}
            title={<><DollarSign size={15} /> {tr('Registrar pagamento')}{roomId !== null ? ` · ${tr('Apartamento')} ${fmtRoom(parseInt(roomId))}` : ''}</>}>
          <PaymentModal
            inline compacto
            open={showPagModal}
            onClose={fecharPagCriar}
            onConfirm={addPagamento}
            tiposPagamento={tiposPagamento}
            titularNome={(() => {
              if (roomId === null) return allHospedes[0]?.nome || null;
              if (periodoMode === 'multiplos') {
                return periodos[Number(roomPi)]?.roomHospedes?.[roomId]?.[0]?.nome || allHospedes[0]?.nome || null;
              }
              return (quartoHospedes[roomId] || [])[0]?.nome || allHospedes[0]?.nome || null;
            })()}
            lastPayerName={(() => {
              const pool = pagModo === 'unico'
                ? pagUnico
                : (quartosPag[showPagModalRoom] || []);
              return pool.at(-1)?.nome_pagador ?? null;
            })()}
            quartoNumero={roomId !== null ? fmtRoom(parseInt(roomId)) : null}
            canAplicarDesconto={false}
            valorTotal={pagVTotal}
            valorPago={pagVPago}
          />
          </GavetaLado>
        );
      })()}
    </JanelaGaveta>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const [reservas,       setReservas]       = useState([]);
  const [categorias,     setCategorias]     = useState([]);
  const [roomDescMap,    setRoomDescMap]    = useState({}); // { [roomId]: descricao }
  const [roomPaxMap,     setRoomPaxMap]     = useState({}); // { [roomId]: quantidade_pessoas }
  const [loading,        setLoading]        = useState(true);
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [viewDate,    setViewDate]    = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [collapsedCats,   setCollapsedCats]   = useState({});
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInit,      setCreateInit]      = useState({ room: null, start: null, end: null, available: null });
  const [searchTerm,      setSearchTerm]      = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [remoteSearchResults, setRemoteSearchResults] = useState([]);
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [showSolicitacoes,   setShowSolicitacoes]   = useState(false);
  const [showGrupos,         setShowGrupos]         = useState(false);
  const [gruposRefreshKey,   setGruposRefreshKey]   = useState(0);
  const [grupoNomes,         setGrupoNomes]         = useState({}); // { [grupo_id]: responsável }
  const [showOrcamentos,     setShowOrcamentos]     = useState(false);
  const [pagamentoModoAtivo,   setPagamentoModoAtivo]   = useState(false);
  const [reservasSelecionadas, setReservasSelecionadas] = useState(new Set());
  const [showPagMultiploModal, setShowPagMultiploModal] = useState(false);
  const [pagMultiploSaving,    setPagMultiploSaving]    = useState(false);
  const [pagMultiploModo,      setPagMultiploModo]      = useState('unico'); // 'unico' | 'por_quarto'
  const [showPagQuartoPicker,  setShowPagQuartoPicker]  = useState(false);
  const [pagQuartoAlvo,        setPagQuartoAlvo]        = useState(null); // reserva escolhida (por quarto)
  const [winWide,              setWinWide]              = useState(typeof window !== 'undefined' ? window.innerWidth >= 1080 : true);
  const [slotDir, setSlotDir] = useState(null);
  const [slotEsq, setSlotEsq] = useState(null);
  const [fechandoReserva, setFechandoReserva] = useState(false);
  const gridScrollRef = useRef(null);
  const [novasIds, setNovasIds] = useState(() => new Set());
  const [focoNova, setFocoNova] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const [winMobile,            setWinMobile]            = useState(typeof window !== 'undefined' ? window.innerWidth <= 600 : false);
  const [escolhaGrupo,         setEscolhaGrupo]         = useState(null); // { reserva, anchor }
  const [grupoInicial,         setGrupoInicial]         = useState(null);
  const [solicitacoes,       setSolicitacoes]       = useState([]);
  const [dayModal,        setDayModal]        = useState(null);
  const [dayRefreshKey,   setDayRefreshKey]   = useState(0);
  const diaHoje = useReservasDoDia(todayStr, dayRefreshKey);
  const diaSel  = useReservasDoDia(dayModal?.dateStr ?? null, dayRefreshKey);
  const diaResumo = dayModal ? diaSel : diaHoje;
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear,      setPickerYear]      = useState(() => new Date().getFullYear());
  const [roomModal, setRoomModal] = useState(null);
  const [selRoom,   setSelRoom]   = useState(null);
  const [selStart,  setSelStart]  = useState(null);
  const [selHover,  setSelHover]  = useState(null);
  const [dragState, setDragState] = useState(null);
  const [ghostDrag, setGhostDrag] = useState(null);
  const [notif,       setNotif]       = useState(null);

  const lastHoverRef        = useRef(null);
  const searchRef           = useRef(null);
  const monthPickerRef      = useRef(null);
  const dragJustHappenedRef = useRef(false);
  const [dragEditValues,   setDragEditValues]   = useState(null); // { quarto, checkin, checkout }

  const notify = useCallback((msg, type = 'success') => {
    setNotif({ message: msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  useEffect(() => { enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {}); }, []);

  // ── Load categories + rooms, then cross-reference ────────────────────────
  useEffect(() => {
    Promise.all([
      quartoCategoriApi.listar({ size: 900 }),
      quartoApi.listar({ size: 900 }),
    ]).then(([catRes, roomRes]) => {
      const catList  = Array.isArray(catRes)  ? catRes  : (catRes?.content  ?? []);
      const roomList = Array.isArray(roomRes) ? roomRes : (roomRes?.content ?? []);

      const descMap = {};
      const paxMap  = {};
      roomList.forEach((r) => {
        if (!r.id) return;
        descMap[r.id] = r.descricao ?? '';
        paxMap[r.id]  = r.quantidade_pessoas ?? r.quantidadePessoas ?? null;
      });
      setRoomDescMap(descMap);
      setRoomPaxMap(paxMap);

      setCategorias(
        catList
          .map((c) => {
            // First try quartos embedded in category response
            let quartos = (c.quartos ?? []).map((q) => q.id ?? q);
            // Fall back: filter rooms list by categoriaId
            if (!quartos.length) {
              quartos = roomList
                .filter((r) => (r.categoriaId ?? r.categoria?.id) === c.id)
                .map((r) => r.id);
            }
            return {
              id: c.id,
              nome: c.nome,
              quartos,
              checkin:  c.hora_checkin  ?? c.checkin  ?? null,
              checkout: c.hora_checkout ?? c.checkout ?? null,
            };
          })
          .filter((c) => c.quartos.length > 0),
      );
    }).catch(() => {});
  }, []);

  const flattenReservas = (data) => {
    const groups = Array.isArray(data) ? data : [];
    const seenIds = new Set();
    const flat = [];
    for (const group of groups) {
      for (const r of (group.reservas ?? [])) {
        if (!seenIds.has(r.id)) { seenIds.add(r.id); flat.push(r); }
      }
    }
    return flat.map(normalizeReserva).filter((r) => r.dataInicio);
  };

  const mergeFlat = (a, b) => {
    const seen = new Set(a.map((r) => r.id));
    return [...a, ...b.filter((r) => !seen.has(r.id))];
  };

  const flatAndNorm = (arr) => {
    const items = Array.isArray(arr) ? arr : [];
    const seen = new Set();
    const out = [];
    for (const r of items) {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
    }
    return out.filter((r) => r.dataInicio);
  };

  const loadReservas = async () => {
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();
    const nextMonthDate = new Date(ano, mes, 1);
    const nextMes = nextMonthDate.getMonth() + 1;
    const nextAno = nextMonthDate.getFullYear();

    setLoading(true);
    try {
      const [curr, next] = await Promise.all([
        hospedagemApi.buscar({ status: ['RESERVA_ATIVA', 'PERNOITE_ATIVO', 'PERNOITE_FINALIZADO'], mes, ano }),
        hospedagemApi.buscar({ status: ['RESERVA_ATIVA', 'PERNOITE_FINALIZADO'], mes: nextMes, ano: nextAno }),
      ]);
      setReservas(mergeFlat(flatAndNorm(curr), flatAndNorm(next)));
    } catch (_) {
      // ignore load failures here
    } finally {
      setLoading(false);
    }

    try {
      const data = await hospedagemApi.buscar({ status: 'RESERVA_SOLICITADA' });
      const flat = Array.isArray(data) ? data : [];
      const seen = new Set();
      const deduped = [];
      for (const r of flat) {
        if (!seen.has(r.id)) { seen.add(r.id); deduped.push(normalizeReserva(r)); }
      }
      setSolicitacoes(deduped.filter((r) => r.dataInicio));
    } catch (_) {
      // ignore solicitacoes load failures here
    }
  };

  // Sempre que as reservas mudam (qualquer ação: ativar, hospedar, pagar, cancelar…),
  // sinaliza o DayModal aberto para recarregar sua própria lista.
  useEffect(() => {
    setDayRefreshKey((v) => v + 1);
  }, [reservas]);

  // ── Reload reservations when month/year changes ───────────────────────────
  useEffect(() => {
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();

    // The 31-day window almost always spans into the next month, so fetch both
    const nextMonthDate = new Date(ano, mes, 1);
    const nextMes = nextMonthDate.getMonth() + 1;
    const nextAno = nextMonthDate.getFullYear();

    // Main calendar: RESERVA_ATIVA por mês/ano
    loadReservas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate.getMonth(), viewDate.getFullYear()]);

  // ── Real-time: recarrega quando outro usuário altera uma reserva ──────────
  // O servidor faz broadcast via WebSocket após qualquer mutação no calendário.
  // Recarregamos com debounce para agrupar rajadas (ex.: reserva em grupo).
  const wsReloadTimer = useRef(null);
  useCalendarSocket(() => {
    clearTimeout(wsReloadTimer.current);
    wsReloadTimer.current = setTimeout(() => { loadReservas(); }, 400);
  });

  // Close search dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Close month picker on outside click
  useEffect(() => {
    if (!showMonthPicker) return;
    const h = (e) => { if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setShowMonthPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMonthPicker]);

  // Remote search — single request without mes/ano to cover all months
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) { setRemoteSearchResults([]); setRemoteSearchLoading(false); return; }
    setRemoteSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await hospedagemApi.buscar({ status: 'RESERVA_ATIVA', nomeTitular: term });
        if (cancelled) return;
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const results = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); results.push(normalizeReserva(r)); }
        }
        setRemoteSearchResults(results.filter((r) => r.dataInicio));
      } catch { /* ignore */ } finally {
        if (!cancelled) setRemoteSearchLoading(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm]);

  const days        = Array.from({ length: VISIBLE_DAYS }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d; });
  const daysStr     = days.map((d) => formatDate(d));
  const firstDayStr = daysStr[0];
  const lastDayStr  = daysStr[daysStr.length - 1];

  const shiftMonth = (delta) => {
    setViewDate((d) => {
      const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      const isCurrent = target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
      if (isCurrent) { const y = new Date(today); y.setDate(y.getDate() - 1); return y; }
      return target;
    });
  };

  const goToToday = () => { const d = new Date(today); d.setDate(d.getDate() - 1); setViewDate(d); };

  const shiftDay = (delta) => { setViewDate((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; }); };

  const monthLabel = viewDate.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

  const searchNorm = normalizeStr(searchTerm.trim());

  // Calendar always shows all reservations regardless of search
  const [showStatusFilter,   setShowStatusFilter]   = useState(false);
  const [statusModalFilter,  setStatusModalFilter]  = useState(null); // { key, label }
  const statusFilterRef = useRef(null);
  const [floatExpanded,      setFloatExpanded]      = useState(false);

  useEffect(() => {
    const h = (e) => { if (statusFilterRef.current && !statusFilterRef.current.contains(e.target)) setShowStatusFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allReservas = [...reservas, ...solicitacoes];

  // Responsável do grupo (grupo_reserva.descricao) só vem em GET /hospedagem/grupos.
  const gruposVisiveis = [...new Set(allReservas.map((r) => r.grupo_id).filter((g) => g != null))].sort().join(',');
  useEffect(() => {
    if (!gruposVisiveis) return;
    hospedagemApi.listarGrupos()
      .then((list) => setGrupoNomes(Object.fromEntries((Array.isArray(list) ? list : [])
        .filter((g) => g.descricao).map((g) => [g.grupo_id, g.descricao]))))
      .catch(() => {});
  }, [gruposVisiveis, gruposRefreshKey]);
  const filteredReservas = allReservas;

  const searchResults = searchNorm.length >= 2
    ? allReservas.filter((r) =>
        normalizeStr(r.titularNome).includes(searchNorm) ||
        (r.empresaNome && normalizeStr(r.empresaNome).includes(searchNorm)) ||
        (r.pessoasOrcamento ?? []).some((p) => normalizeStr(p.nome).includes(searchNorm))
      ).slice(0, 8)
    : [];

  // Remote results grouped by month for the dropdown separator
  const remoteSearchByMonth = (() => {
    if (!remoteSearchResults.length) return [];
    const groups = {};
    for (const r of remoteSearchResults) {
      const d = new Date(r.dataInicio + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { key, label, items: [] };
      groups[key].items.push(r);
    }
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  })();

  const navigateToReserva = (r) => {
    if (!isDesktop) { setSearchTerm(''); setShowSearchDropdown(false); setRemoteSearchResults([]); }
    setSelectedReserva(r);
  };

  const solicitadasCount = solicitacoes.length;
  const allRooms         = categorias.flatMap((c) => c.quartos);

  const { pagMultiploValorTotal, pagMultiploValorPago, pagMultiploLastPayer } = useMemo(() => {
    if (reservasSelecionadas.size === 0) return { pagMultiploValorTotal: 0, pagMultiploValorPago: 0, pagMultiploLastPayer: null };
    const selecionadas = allReservas.filter((r) => reservasSelecionadas.has(r.id));
    // Deduplicate payments by UUID — the same payment can be linked to multiple reservations
    const seen = new Map(); // id → { valor, nomePagador, dataRegistro }
    for (const r of selecionadas) {
      for (const p of (r.pagamentos ?? [])) {
        if (!p.cancelado && !seen.has(p.id)) seen.set(p.id, p);
      }
    }
    const uniquePags = Array.from(seen.values());
    uniquePags.sort((a, b) => (b.dataRegistro ?? '').localeCompare(a.dataRegistro ?? ''));
    return {
      pagMultiploValorTotal: selecionadas.reduce((s, r) => s + (r.valorTotal ?? 0), 0),
      pagMultiploValorPago:  uniquePags.filter((p) => !isPagamentoPendente(p.formaPagamento)).reduce((s, p) => s + (p.valor ?? 0), 0),
      pagMultiploLastPayer:  uniquePags[0]?.nomePagador ?? null,
    };
  }, [reservasSelecionadas, allReservas]);

  const handleApproveSolicitacao = async (id, quarto) => {
    const upd = await reservaApi.atualizar({ id, fk_quarto: quarto });
    const normalized = normalizeReserva(upd);
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    setReservas((rs) => [...rs.filter((r) => r.id !== id), normalized]);
    notify(tr('Solicitação aprovada!')); setShowSolicitacoes(false);
  };
  const handleRejectSolicitacao = async (id) => {
    await reservaApi.cancelar(id);
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    notify(tr('Solicitação rejeitada.')); setShowSolicitacoes(false);
  };

  const handleCellClick = (room, dateStr) => {
    if (pagamentoModoAtivo) return;
    if (dragState) return;
    if (dateStr < todayStr) return;
    if (selRoom === room && selStart !== null) {
      if (dateStr === selStart) { setSelRoom(null); setSelStart(null); setSelHover(null); return; }
      const start = dateStr < selStart ? dateStr : selStart;
      const end   = dateStr < selStart ? selStart : dateStr;
      setCreateInit({ room, start, end, available: null });
      setShowCreateModal(true);
      setSelRoom(null); setSelStart(null); setSelHover(null); return;
    }
    const occupied = filteredReservas.some((r) => r.quarto === room && r.dataInicio <= dateStr && r.dataFim > dateStr);
    if (occupied) return;
    setSelRoom(room); setSelStart(dateStr); setSelHover(dateStr);
  };

  const handleRoomMouseMove = (e, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx  = Math.floor((e.clientX - rect.left) / DAY_CELL_W);
    if (idx < 0 || idx >= VISIBLE_DAYS) return;
    const dateStr = daysStr[idx];
    const key = `${room}-${dateStr}`;
    if (lastHoverRef.current === key) return;
    lastHoverRef.current = key;
    if (dragState) handleDragHover(room, dateStr);
    else if (selRoom === room) setSelHover(dateStr);
  };

  const isCellSelected = (room, dateStr) => {
    if (selRoom !== room || !selStart) return false;
    const hov = selHover || selStart;
    const lo  = selStart < hov ? selStart : hov;
    const hi  = selStart < hov ? hov : selStart;
    return dateStr >= lo && dateStr <= hi;
  };

  const handleBarMouseDown = (e, r) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
    setDragState({ type: 'move', id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };
  const handleResizeMouseDown = (e, r, edge) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
    setDragState({ type: edge, id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };
  const handleDragHover = (room, dateStr) => {
    if (!dragState || !ghostDrag) return;
    if (dragState.type === 'move') {
      const dur = diffDays(dragState.origInicio, dragState.origFim);
      setGhostDrag({ quarto: room, dataInicio: dateStr, dataFim: addDays(dateStr, dur) });
    } else if (dragState.type === 'resize-l') {
      if (dragState.origQuarto !== room) return;
      if (dateStr < dragState.origFim) setGhostDrag((g) => ({ ...g, dataInicio: dateStr }));
    } else if (dragState.type === 'resize-r') {
      if (dragState.origQuarto !== room) return;
      const nd = addDays(dateStr, 1);
      if (nd > dragState.origInicio) setGhostDrag((g) => ({ ...g, dataFim: nd }));
    }
  };

  const dragStateRef = useRef(dragState); const ghostDragRef = useRef(ghostDrag); const reservasRef = useRef(reservas);
  dragStateRef.current = dragState; ghostDragRef.current = ghostDrag; reservasRef.current = reservas;

  const handleGlobalMouseUp = useCallback(() => {
    const ds = dragStateRef.current; const gd = ghostDragRef.current;
    if (!ds || !gd) return;
    const r = reservasRef.current.find((x) => x.id === ds.id);
    if (!r) { setDragState(null); setGhostDrag(null); return; }
    const changed = gd.quarto !== r.quarto || gd.dataInicio !== r.dataInicio || gd.dataFim !== r.dataFim;
    if (changed) {
      dragJustHappenedRef.current = true;
      setTimeout(() => { dragJustHappenedRef.current = false; }, 300);
      // Open edit modal with the ghost values pre-filled
      setDragEditValues({ quarto: gd.quarto, checkin: gd.dataInicio, checkout: gd.dataFim });
      setSelectedReserva(r);
    }
    setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
  }, []);

  useEffect(() => { window.addEventListener('mouseup', handleGlobalMouseUp); return () => window.removeEventListener('mouseup', handleGlobalMouseUp); }, [handleGlobalMouseUp]);
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
        setSelRoom(null); setSelStart(null); setSelHover(null);
        setPagamentoModoAtivo(false); setReservasSelecionadas(new Set()); setShowPagMultiploModal(false);
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (!focoNova || loading) return;
    const id = requestAnimationFrame(() => {
      const box = gridScrollRef.current;
      const el  = box?.querySelector(`[data-room="${focoNova.quarto}"]`);
      if (box && el) box.scrollTo({ top: Math.max(0, el.offsetTop - HDR_H - 96), left: 0, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focoNova, loading]);

  const handleSaveNew = async (bodyOrFlag) => {
    // Nova reserva pode criar ou entrar num grupo — a lista de grupos recarrega.
    setGruposRefreshKey((k) => k + 1);

    // ── Orçamento criado via orcamentoApi.criar ───────────────────────────────
    if (bodyOrFlag?._isOrcamento) {
      notify(tr('Orçamento criado!'));
      setShowCreateModal(false);
      return;
    }

    // ── Solicitação criada via reservaApi.solicitar ───────────────────────────
    if (bodyOrFlag?._isSolicitacao) {
      notify(tr('Solicitação criada!'));
      setShowCreateModal(false);
      return;
    }

    // ── Reserva ativa criada via reservaApi.criarAtiva ────────────────────────
    if (bodyOrFlag?._isReserva) {
      const novas = (bodyOrFlag.results ?? [])
        .filter(Boolean)
        .map(normalizeReserva)
        .filter((r) => r.dataInicio);
      if (novas.length > 0) {
        setReservas((rs) => [...rs, ...novas]);
        // leva o calendário até a nova reserva e a destaca por alguns segundos
        const prim = [...novas].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))[0];
        const cat  = categorias.find((c) => c.quartos.includes(prim.quarto));
        if (cat) setCollapsedCats((prev) => ({ ...prev, [cat.id]: false }));
        const d = new Date(prim.dataInicio + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        setViewDate(d);
        setNovasIds(new Set(novas.map((n) => n.id)));
        setFocoNova({ quarto: prim.quarto, t: Date.now() });
        setTimeout(() => setNovasIds(new Set()), 5000);
      } else {
        await loadReservas();
      }
      notify(novas.length > 1 ? tr('{{length}} reservas criadas!', { length: novas.length }) : tr('Reserva criada!'));
      setShowCreateModal(false);
      return;
    }
  };
  // orcamentoId: ID do orçamento (não da hospedagem) — passado quando status === 'orcamento'
  const handleCancelReserva = async (id, motivo, orcamentoId = null) => {
    try {
      if (orcamentoId) {
        // PUT /orcamento/{orcamentoId}/cancelar — cancela todas as hospedagens do orçamento
        await orcamentoApi.cancelar(orcamentoId, motivo);
      } else {
        await reservaApi.cancelar(id, motivo);
      }
    } catch (e) {
      notify(e?.message ?? (orcamentoId ? tr('Erro ao cancelar orçamento.') : tr('Erro ao cancelar reserva.')), 'error');
      return;
    }
    setReservas((rs) => rs.filter((r) => r.id !== id));
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    notify(orcamentoId ? tr('Orçamento cancelado.') : tr('Reserva cancelada.'));
  };

  // Gera um voucher PDF completo com todas as reservas do grupo
  const handleGroupVoucher = async (members) => {
    const _u = userStorage.get();

    // O responsável do grupo é grupo_reserva.descricao, que não vem junto das
    // hospedagens — só em GET /hospedagem/grupos. Sem ele, o voucher cai no
    // titular da primeira reserva.
    const grupoId = members[0]?.grupoId ?? members[0]?.grupo_id ?? null;
    let responsavel = '';
    if (grupoId != null) {
      try {
        const grupos = await hospedagemApi.listarGrupos();
        responsavel = (Array.isArray(grupos) ? grupos : [])
          .find((g) => g.grupo_id === grupoId)?.descricao ?? '';
      } catch { /* mantém o fallback */ }
    }
    const displayPeriodos = members.map((r) => ({
      checkin: r.dataInicio,
      checkout: r.dataFim,
      rooms: [String(r.quarto)],
      roomHospedes: { [String(r.quarto)]: r.hospedes ?? [] },
    }));
    const precosCalc = {};
    const quartosObs = {};
    members.forEach((r, i) => {
      precosCalc[`${r.quarto}_${i}`] = { valor_total: r.valorTotal ?? 0, detalhes: [], sazonalidades_aplicadas: [] };
      if (r.observacao) quartosObs[`${r.quarto}_${i}`] = r.observacao;
    });
    // Pagamentos do grupo deduplicados por UUID (um pagamento único pode estar em várias reservas)
    const seen = new Map();
    members.forEach((r) => (r.pagamentos ?? []).forEach((p) => {
      if (!p.cancelado && !seen.has(p.id)) seen.set(p.id, p);
    }));
    gerarVoucherReserva({
      tipo: 'grupo',
      periodoMode: 'multiplos',
      displayPeriodos,
      precosCalc,
      quartosObs,
      roomDescMap,
      userName: _u?.pessoa?.nome ?? _u?.nome ?? '',
      solicitante: {
        nome: responsavel || members[0]?.titularNome || '',
        cpf:  members[0]?.hospedes?.[0]?.cpf ?? '',
      },
      pagamentos: Array.from(seen.values()),
    });
  };

  const handleMoverPernoite = async (id) => {
    try {
      // Apenas altera o status da hospedagem para PERNOITE_ATIVO — atualiza o estado localmente
      await hospedagemApi.alterarStatus(id, 'PERNOITE_ATIVO');
      setReservas((rs) => rs.map((r) => r.id === id ? { ...r, status: 'hospedado' } : r));
      setSelectedReserva((prev) => prev && prev.id === id ? { ...prev, status: 'hospedado' } : prev);
      notify(tr('Hospedagem iniciada!'));
    } catch (e) {
      notify(e?.message ?? tr('Erro ao hospedar.'), 'error');
    }
  };

  const handleMarcarAusente = async (id) => {
    try {
      await reservaApi.marcarAusente(id);
      // RESERVA_AUSENTE sai da listagem de ativas do calendário
      setReservas((rs) => rs.filter((r) => r.id !== id));
      notify(tr('Reserva marcada como ausente.'));
    } catch (e) {
      notify(e?.message ?? tr('Erro ao marcar reserva como ausente.'), 'error');
    }
  };

  const handleActivateReserva = async (id) => {
    try {
      await reservaApi.atualizarStatus([id], 'RESERVA_ATIVA');
      const upd = await reservaApi.buscarPorId(id);
      const normalized = normalizeReserva(upd);
      setReservas((rs) => [...rs.filter((r) => r.id !== id), normalized]);
      setSelectedReserva(normalized);
      notify(tr('Reserva ativada!'));
    } catch (e) {
      notify(e?.message ?? tr('Erro ao ativar reserva.'), 'error');
    }
  };

  const handleUpdateReserva = async (id, body) => {
    try {
      const upd = await reservaApi.editar(id, body);
      const normalized = normalizeReserva(upd ?? { ...body, id });
      setReservas((rs) => rs.map((r) => r.id === id ? normalized : r));
      setSelectedReserva((prev) => prev?.id === id ? normalized : prev);
      setDragEditValues(null);
      notify(tr('Reserva atualizada!'));
    } catch (e) {
      notify(e?.message ?? tr('Erro ao atualizar reserva.'), 'error');
      throw e;
    }
  };

  const handleSyncReserva = (normalized) => {
    setReservas((rs) => rs.map((r) => r.id === normalized.id ? normalized : r));
    setSelectedReserva((prev) => prev?.id === normalized.id ? normalized : prev);
    setGruposRefreshKey((k) => k + 1);
  };

  const exitSelectionMode = useCallback(() => {
    setPagamentoModoAtivo(false);
    setReservasSelecionadas(new Set());
    setShowPagMultiploModal(false);
    setPagMultiploModo('unico');
    setShowPagQuartoPicker(false);
    setPagQuartoAlvo(null);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setWinWide(window.innerWidth >= 1080);
      setWinMobile(window.innerWidth <= 600);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePagamentoMultiplo = async (payment) => {
    setPagMultiploSaving(true);
    try {
      if (pagMultiploModo === 'por_quarto') {
        // Pagamento para o quarto escolhido apenas.
        if (!pagQuartoAlvo) return;
        await hospedagemApi.adicionarPagamentoMultiplo([pagQuartoAlvo.id], payment);
        await loadReservas();
        notify(tr('Pagamento adicionado ao Ap. {{v0}}!', { v0: fmtRoom(pagQuartoAlvo.quarto) }));
        setShowPagMultiploModal(false);
        setPagQuartoAlvo(null);
        // permanece no modo de seleção para pagar outros quartos
        return;
      }

      // Pagamento único: um só pagamento compartilhado por todas as reservas.
      const selecionadas = allReservas.filter((r) => reservasSelecionadas.has(r.id));
      const ids = selecionadas.map((r) => r.id);
      const grupos = new Set(selecionadas.map((r) => r.grupo_id).filter((g) => g != null));
      const grupoUnico = grupos.size === 1 && selecionadas.every((r) => r.grupo_id != null)
        ? [...grupos][0]
        : null;
      if (grupoUnico != null) {
        await hospedagemApi.adicionarPagamentoGrupo(grupoUnico, payment);
      } else {
        await hospedagemApi.adicionarPagamentoMultiplo(ids, payment);
      }
      await loadReservas();
      notify(tr('Pagamento adicionado a {{length}} reserva{{v1}}!', { length: ids.length, v1: ids.length !== 1 ? 's' : '' }));
      exitSelectionMode();
    } catch (e) {
      notify(e?.message ?? tr('Erro ao adicionar pagamento.'), 'error');
    } finally {
      setPagMultiploSaving(false);
    }
  };

  // ── Render bars ────────────────────────────────────────────────────────────
  const renderBars = (room) => {
    const toRender = filteredReservas.filter((r) => r.quarto === room);
    const bars = [];
    for (const r of toRender) {
      const isBeingDragged = dragState?.id === r.id;
      const useGhost       = isBeingDragged && ghostDrag && ghostDrag.quarto === room;
      const displayR       = useGhost ? { ...r, ...ghostDrag } : r;
      const el = buildBar(displayR, r, { opacity: isBeingDragged && !useGhost ? 0.35 : 1, isGhost: false, isDragging: isBeingDragged });
      if (el) bars.push(el);
    }
    if (dragState && ghostDrag && ghostDrag.quarto === room) {
      const orig = reservas.find((r) => r.id === dragState.id);
      if (orig && orig.quarto !== room) {
        const el = buildBar({ ...orig, ...ghostDrag }, orig, { isGhost: true });
        if (el) bars.push(el);
      }
    }
    return bars;
  };

  const buildBar = (display, orig, { opacity = 1, isGhost = false, isDragging = false }) => {
    const { dataInicio, dataFim } = display;
    const startInView = dataInicio >= firstDayStr;
    const endInView   = dataFim   <= addDays(lastDayStr, 1);

    let left;
    if (!startInView) { left = 0; }
    else { const idx = daysStr.indexOf(dataInicio); if (idx < 0) return null; left = idx * DAY_CELL_W + HALF; }

    let right;
    if (!endInView) { right = VISIBLE_DAYS * DAY_CELL_W; }
    else {
      const idx = daysStr.indexOf(dataFim);
      if (idx < 0 && dataFim > lastDayStr) right = VISIBLE_DAYS * DAY_CELL_W;
      else if (idx < 0) return null;
      else right = idx * DAY_CELL_W + HALF;
    }

    const width = right - left;
    if (width <= 4) return null;

    // Faixa flutuante: pontas arredondadas e afastadas da linha quando visíveis;
    // retas e coladas na borda quando a reserva continua fora da janela.
    const insetL       = startInView ? BAR_INSET : 0;
    const insetR       = endInView   ? BAR_INSET : 0;
    const temMeia      = !isGhost && orig.meiaDiaria && endInView;
    const rLeft        = startInView ? 6 : 0;
    const rRight       = endInView && !temMeia ? 6 : 0;
    const borderRadius = `${rLeft}px ${rRight}px ${rRight}px ${rLeft}px`;
    const dias         = diffDays(orig.dataInicio, orig.dataFim);
    const totalPeople  = 1 + (orig.quantidadeAcompanhantes || 0);
    const key          = isGhost ? `ghost-${orig.id}` : `bar-${orig.id}`;

    const currentDiaria = orig.status === 'hospedado'
      ? Math.min(dias, Math.max(1, diffDays(orig.dataInicio, todayStr) + 1)) : null;

    const isCancelado   = orig.status === 'cancelado';
    const isFinalizado  = orig.status === 'finalizado';
    const isSelSelected = pagamentoModoAtivo && reservasSelecionadas.has(orig.id);
    const isSelDimmed   = pagamentoModoAtivo && !isSelSelected;
    const barOpacity    = isSelDimmed ? Math.min(opacity, 0.4)
      : isCancelado  ? Math.min(opacity, 0.55)
      : isFinalizado ? Math.min(opacity, 0.6)
      : opacity;
    // grupoCor: cor real do grupo (independe do status) — usada no ticket e no painel flutuante.
    // gColor: cor de fundo da barra — null em hospedado, mantendo o corpo cinza escuro.
    const grupoCor      = !isGhost && orig.grupo_id != null ? grupoColor(orig.grupo_id) : null;
    const gColor        = grupoCor && orig.status !== 'hospedado' && orig.status !== 'finalizado' ? grupoCor : null;

    return (
      <div key={key}
        className={[styles.bar, styles[`bar_${orig.status}`], isGhost ? styles.barGhost : '', isDragging ? styles.barDragging : '', novasIds.has(orig.id) ? styles.barNova : ''].join(' ')}
        style={{
          left: left + insetL, width: width - insetL - insetR, borderRadius,
          opacity: barOpacity,
          cursor: pagamentoModoAtivo ? 'pointer' : undefined,
          ...(gColor ? { background: gColor } : {}),
          ...(isSelSelected ? { outline: '2px solid #fff', outlineOffset: '1px', filter: 'brightness(1.15)' } : {}),
        }}
        onMouseDown={isGhost || pagamentoModoAtivo ? undefined : (e) => handleBarMouseDown(e, orig)}
        onClick={(e) => {
          e.stopPropagation();
          if (pagamentoModoAtivo) {
            // Reserva em grupo: seleciona/desmarca o grupo inteiro (um pagamento único para o grupo).
            const alvoIds = orig.grupo_id != null
              ? allReservas.filter((r) => r.grupo_id === orig.grupo_id && r.status !== 'cancelado').map((r) => r.id)
              : [orig.id];
            setReservasSelecionadas((prev) => {
              // Só um grupo/reserva por vez: selecionar outro substitui o anterior.
              const mesmo = prev.size === alvoIds.length && alvoIds.every((id) => prev.has(id));
              return mesmo ? new Set() : new Set(alvoIds);
            });
            return;
          }
          if (dragState || dragJustHappenedRef.current) return;
          if (orig.grupo_id != null) setEscolhaGrupo({ reserva: orig, anchor: e.currentTarget });
          else setSelectedReserva(orig);
        }}
        title={pagamentoModoAtivo ? `${isSelSelected ? '✓ ' : ''}${orig.titularNome}` : `${orig.titularNome} — ${diariasTxt(dias)}`}
      >
        {/* Floating status label — always above the bar */}
        {!isGhost && (
          <div
            className={startInView ? styles.barStatusTag : styles.barStatusTagInline}
            style={grupoCor ? { background: `color-mix(in srgb, ${grupoCor} 70%, #000)` } : undefined}
          >
            {orig.status === 'confirmada' && (grupoCor ? <>{tr('Reserva em grupo #')}{orig.grupo_id}</> : orig.empresaNome ? <><Building2 size={9} strokeWidth={2.5} /> {tr('Reserva empresa')}</> : <><Check size={9} strokeWidth={3} /> {tr('Reserva Individual')}</>)}
            {orig.status === 'solicitada' && <>{tr('Reserva solicitada')}</>}
            {orig.status === 'hospedado'  && (grupoCor ? <>{tr('Hospedagem em grupo #')}{orig.grupo_id}</> : orig.empresaNome ? <><Building2 size={9} strokeWidth={2.5} /> {tr('Hospedagem empresa')}</> : <><Check size={9} strokeWidth={3} /> {tr('Hospedado')}</>)}
            {orig.status === 'finalizado' && <>{tr('Finalizado')}</>}
            {orig.status === 'cancelado'  && <>{tr('Cancelado')}</>}
            {orig.status === 'orcamento'  && <>{tr('Orçamento')}</>}
          </div>
        )}

        {startInView && !isGhost && !pagamentoModoAtivo && (
          <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-l')} />
        )}
        {/* Pessoas e diárias metade para fora, no começo da faixa */}
        {!isGhost && (
          <span className={[styles.barInfo, startInView ? '' : styles.barInfoInline].join(' ')}
            style={grupoCor ? { background: `color-mix(in srgb, ${grupoCor} 70%, #000)` } : undefined}>
            <span><Users size={11} /> {totalPeople}</span>
            <span><CalendarDays size={11} /> {currentDiaria !== null ? `${currentDiaria}/${dias}` : dias}</span>
          </span>
        )}
        <div className={[styles.barContent, isGhost ? '' : startInView ? styles.barContentInfo : styles.barContentInfoInline].join(' ')}>
          {isGhost && <span className={styles.barAvatar}>{initials(orig.titularNome)}</span>}
          <div className={styles.barText}>
            <span className={styles.barName}>{orig.titularNome}</span>
            {(() => {
              if (orig.empresaNome) return <span className={[styles.barSub, styles.barEmpresa].join(' ')}><Building2 size={11} /> {orig.empresaNome}</span>;
              const resp = orig.grupo_id != null ? grupoNomes[orig.grupo_id] : null;
              const sub = resp && resp.toUpperCase() !== String(orig.titularNome).toUpperCase() ? resp : null;
              return sub ? <span className={styles.barSub}>{sub}</span> : null;
            })()}
            {isGhost && (
              <span className={styles.barDateLabel}>{fmtDateBR(display.dataInicio)} → {fmtDateBR(display.dataFim)} · {diariasTxt(diffDays(display.dataInicio, display.dataFim))}</span>
            )}
          </div>
        </div>
        {endInView && !isGhost && !pagamentoModoAtivo && (
          <div className={[styles.resizeHandle, styles.resizeHandleRight].join(' ')} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-r')} />
        )}
        {/* Meio ticket (meia diária) — estende metade de célula até a borda, cor do ticket a 70%. */}
        {temMeia && (
          <div
            className={styles.barHalf}
            style={{ width: HALF, ...(gColor ? { background: gColor } : {}) }}
            title={tr('Meia diária — saída tardia')}
          >
            <Clock size={12} />
          </div>
        )}
      </div>
    );
  };

  const leftW      = winMobile ? LEFT_W_MOBILE : winWide ? LEFT_W : LEFT_W_NARROW;
  const gridTotalW = leftW + VISIBLE_DAYS * DAY_CELL_W;

  const buscaItens = (
    <>
              {searchResults.map((r) => {
                const dias     = diffDays(r.dataInicio, r.dataFim);
                const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
                return (
                  <div key={r.id} className={styles.searchDropItem} onClick={() => navigateToReserva(r)}>
                    <div className={styles.searchDropRoomCircle}>{fmtRoom(r.quarto)}</div>
                    <div className={styles.searchDropInfo}>
                      <div className={styles.searchDropName}>{r.titularNome}</div>
                      <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                      <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} {tr('pessoa')}{nPessoas !== 1 ? 's' : ''}</div>
                    </div>
                    <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
                  </div>
                );
              })}
              {remoteSearchLoading && (
                <Esqueleto linhas={2} />
              )}
              {!remoteSearchLoading && remoteSearchByMonth.map((group) => (
                <div key={group.key}>
                  <div className={styles.searchDropSeparator}>{group.label}</div>
                  {group.items.map((r) => {
                    const dias     = diffDays(r.dataInicio, r.dataFim);
                    const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
                    return (
                      <div key={r.id} className={styles.searchDropItem} onClick={() => navigateToReserva(r)}>
                        <div className={styles.searchDropRoomCircle}>{fmtRoom(r.quarto)}</div>
                        <div className={styles.searchDropInfo}>
                          <div className={styles.searchDropName}>{r.titularNome}</div>
                          <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                          <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} {tr('pessoa')}{nPessoas !== 1 ? 's' : ''}</div>
                        </div>
                        <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
    </>
  );
  const buscando = searchTerm.trim().length >= 2;

  const buscaEl = (
        <div className={styles.searchWrap} ref={searchRef}>
          <Search size={13} className={styles.searchIcon} />
          <input className={styles.searchInput} value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); }}
            onFocus={() => searchTerm.length >= 2 && setShowSearchDropdown(true)}
            placeholder={tr('Buscar hóspede...')} />
          {searchTerm && (
            <button className={styles.clearSearch} onClick={() => { setSearchTerm(''); setShowSearchDropdown(false); setRemoteSearchResults([]); }}><X size={12} /></button>
          )}
          {!isDesktop && showSearchDropdown && (searchResults.length > 0 || remoteSearchResults.length > 0 || remoteSearchLoading) && (
            <div className={styles.searchDropdown}>{buscaItens}</div>
          )}
        </div>
  );

  return (
    <JanelaDirCtx.Provider value={isDesktop ? slotDir : null}>
    <JanelaCtx.Provider value={isDesktop ? slotDir : null}>
    <div className={styles.page}>
      <Notification notification={notif} />
      <div className={styles.split}>
        {isDesktop && (
          <aside className={styles.sidePanel}>
                <div className={styles.sideTopo}>
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={() => { setCreateInit({ room: null, start: null, end: null, available: null }); setShowCreateModal(true); }}>
                  {tr('Nova reserva')}
                </Button>
                <div className={styles.sideBusca}>
                  {buscaEl}
                  <div className={styles.sideFiltroWrap} ref={statusFilterRef}>
                    <button type="button"
                      className={[styles.sideFiltroBtn, showStatusFilter ? styles.sideFiltroBtnOn : ''].join(' ')}
                      onClick={() => setShowStatusFilter((v) => !v)}
                      title={tr('Filtrar por status')} aria-label={tr('Filtrar por status')} aria-expanded={showStatusFilter}>
                      <SlidersHorizontal size={16} />
                    </button>
                    {showStatusFilter && (
                      <div className={styles.sideFiltroPop}>
                        <span className={styles.sideFiltroTit}>{tr('Reservas por status')}</span>
                        {STATUS_FILTER_OPTIONS.map(([key, label]) => (
                          <button key={key} type="button" className={styles.sideFiltroItem}
                            onClick={() => { setStatusModalFilter({ key, label }); setShowStatusFilter(false); }}>
                            <span className={[styles.statusDot, styles[`status_${key}`]].join(' ')} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                </div>
                {buscando ? (
                  <div className={styles.sideGrupo}>
                    <span className={[styles.sideGrupoTit, styles.sideGrupoTitEscuro].join(' ')}>{tr('Resultados da busca')}</span>
                    {(searchResults.length > 0 || remoteSearchResults.length > 0 || remoteSearchLoading) ? (
                      <div className={styles.sideResultados}>{buscaItens}</div>
                    ) : (
                      <p className={styles.sideVazio}>{tr('Nenhum hóspede encontrado.')}</p>
                    )}
                  </div>
                ) : (
                <div className={styles.sideGrupo}>
                  <span className={styles.sideGrupoTit}>{tr('Serviços')}</span>
                  <div ref={setSlotEsq} className={styles.slotEsq} />
                  <div className={styles.sideItens}>
                  {[
                    { k: 'grupos', ic: <Users size={16} />,    rot: tr('Grupos'),       sub: tr('Reservas em grupo e pagamentos'),  on: () => { setGrupoInicial(null); setShowGrupos(true); } },
                    { k: 'orc',    ic: <FileText size={16} />, rot: tr('Orçamentos'),   sub: tr('Propostas enviadas aos hóspedes'), on: () => setShowOrcamentos(true) },
                    { k: 'sol',    ic: <Bell size={16} />,     rot: tr('Solicitações'), sub: tr('Pedidos aguardando aprovação'),    on: () => setShowSolicitacoes(true), n: solicitadasCount },
                  ].map((s) => (
                    <button key={s.k} type="button" className={styles.sideItem} onClick={s.on}>
                      <span className={styles.sideIco}>{s.ic}</span>
                      <span className={styles.sideTxt}><b>{s.rot}</b><small>{s.sub}</small></span>
                      {s.n > 0 && <span className={styles.sideBadge}>{s.n}</span>}
                      <ChevronRight size={15} className={styles.sideSeta} />
                    </button>
                  ))}
                  </div>
                  <div className={styles.sideHoje}>
                    <span className={styles.sideGrupoTit}>{tr('Reservas de hoje')}</span>
                    <ListaDia dateStr={todayStr} lista={diaHoje.lista} loading={diaHoje.loading}
                      onSelectReserva={(r) => setSelectedReserva(r)} />
                  </div>
                </div>
                )}
          </aside>
        )}
      <div className={styles.direita}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.tableHeader}>
          <div className={styles.tableTools}>
            <div className={styles.navGroup} style={{ position: 'relative' }} ref={monthPickerRef}>
              <button className={styles.navBtn} onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></button>
              <button className={styles.monthLabel} onClick={() => { setPickerYear(viewDate.getFullYear()); setShowMonthPicker((v) => !v); }}>
                {monthLabel}
              </button>
              <button className={styles.navBtn} onClick={() => shiftMonth(1)}><ChevronRight size={14} /></button>
              {showMonthPicker && (
                <div className={styles.monthPickerCard}>
                  <div className={styles.monthPickerYearRow}>
                    <button className={styles.monthPickerArrow} onClick={() => setPickerYear((y) => y - 1)}><ChevronLeft size={13} /></button>
                    <span className={styles.monthPickerYear}>{pickerYear}</span>
                    <button className={styles.monthPickerArrow} onClick={() => setPickerYear((y) => y + 1)}><ChevronRight size={13} /></button>
                  </div>
                  <div className={styles.monthPickerGrid}>
                    {[tr('Jan'),tr('Fev'),tr('Mar'),tr('Abr'),tr('Mai'),tr('Jun'),tr('Jul'),tr('Ago'),tr('Set'),tr('Out'),tr('Nov'),tr('Dez')].map((m, i) => {
                      const isActive = pickerYear === viewDate.getFullYear() && i === viewDate.getMonth();
                      return (
                        <button key={i}
                          className={[styles.monthPickerCell, isActive ? styles.monthPickerCellActive : ''].join(' ')}
                          onClick={() => {
                            const d = new Date(pickerYear, i, 1);
                            setViewDate(d);
                            setShowMonthPicker(false);
                          }}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button className={styles.todayBtn} onClick={goToToday}>{tr('Hoje')}</button>
            {!isDesktop && (
              <button className={[styles.todayBtn, styles.groupsBtn].join(' ')} onClick={() => { setGrupoInicial(null); setShowGrupos(true); }}>
                <Users size={14} /> {tr('Grupos')}
              </button>
            )}

            {!isDesktop && buscaEl}

            {isDesktop && (
              <ResumoDia compacto itens={resumoDoDia(diaResumo.lista, categorias)} loading={diaResumo.loading}
                rotulo={dayModal && dayModal.dateStr !== todayStr ? fmtDiaMes(dayModal.dateStr) : tr('Hoje')} />
            )}

          </div>
        </div>

        {/* Selection hint */}
        {selStart && (
          <div className={styles.selHint}>
            <span>{tr('Apartamento')} <strong>{fmtRoom(selRoom)}</strong> {tr('· a partir de')} <strong>{selStart}</strong> {tr('— clique outra data para definir fim')}</span>
            <button className={styles.selHintClose} onClick={() => { setSelRoom(null); setSelStart(null); setSelHover(null); }}><X size={12} /></button>
          </div>
        )}

        {/* Grid */}
        <div className={styles.gridScrollWrap} style={{ '--left-w': `${leftW}px` }}>
          {!loading && (
            <>
              <button type="button"
                className={`${styles.dayNavBtn} ${styles.dayNavBtnLeft}`}
                onClick={() => shiftDay(-1)}
                title={tr('Dia anterior')}
              >
                <ChevronLeft size={16} />
              </button>
              <button type="button"
                className={`${styles.dayNavBtn} ${styles.dayNavBtnRight}`}
                onClick={() => shiftDay(1)}
                title={tr('Próximo dia')}
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        <div className={styles.gridScroll} ref={gridScrollRef}>
          {loading ? (
            <EsqueletoGrade leftW={leftW} />
          ) : (
            <>
              <div className={styles.dayHeaderRow} style={{ width: gridTotalW }}>
                <div className={styles.cornerCell} style={{ width: leftW, height: HDR_H }}>
                  {tr('Quarto')}
                </div>
                {days.map((day, idx) => {
                  const dStr      = daysStr[idx];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = dStr === todayStr;
                  const weekday   = day.toLocaleDateString(locale(), { weekday: 'long' });
                  return (
                    <div key={idx}
                      className={[styles.dayHeader, isWeekend ? styles.dayHeaderWeekend : '', isToday ? styles.dayHeaderToday : ''].join(' ')}
                      style={{ width: DAY_CELL_W, height: HDR_H }}
                      onClick={() => setDayModal({ dateStr: dStr })}
                      title={tr('Ver reservas — {{v0}}', { v0: fmtDateBR(dStr) })}
                    >
                      <span className={[styles.dayWeekday, isToday ? styles.dayWeekdayToday : ''].join(' ')}>
                        {weekday.charAt(0).toUpperCase() + weekday.slice(1)}
                      </span>
                      <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                        {day.getDate()}{isToday ? tr(' · Hoje') : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {categorias.map((cat) => {
                const isCollapsed = !!collapsedCats[cat.id];
                return (
                  <div key={cat.id}>
                    <div className={styles.catRow} style={{ width: gridTotalW, height: CAT_H }}
                      onClick={() => setCollapsedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}>
                      <div className={styles.catLabel} style={{ width: leftW }}>
                        <ChevronDown size={11} className={`${styles.chevronIcon}${isCollapsed ? ' ' + styles.collapsed : ''}`} />
                        <BedDouble size={11} />{cat.nome}
                      </div>
                      {days.map((_, i) => <div key={i} className={styles.catCell} style={{ width: DAY_CELL_W }} />)}
                    </div>

                    {!isCollapsed && cat.quartos.map((room) => (
                      <div key={room} data-room={room} className={styles.roomRow} style={{ width: gridTotalW, height: ROOM_H }}>
                        <button className={styles.roomLabel} style={{ width: leftW, height: ROOM_H }}
                          onClick={() => setRoomModal({ room })}
                          title={tr('Histórico quarto {{v0}}{{v1}}', { v0: fmtRoom(room), v1: roomDescMap[room] ? ` – ${roomDescMap[room]}` : '' })}>
                          <span className={styles.roomTitle}>
                            <span className={styles.roomNum}>{tr('Apt.')} {fmtRoom(room)}</span>
                          </span>
                          {roomPaxMap[room] != null && (
                            <span className={styles.roomPax}><Users size={14} /> {roomPaxMap[room]}</span>
                          )}
                        </button>
                        <div className={styles.roomCells} onMouseMove={(e) => handleRoomMouseMove(e, room)}>
                          {days.map((day, idx) => {
                            const dStr      = daysStr[idx];
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isToday   = dStr === todayStr;
                            const isSel     = isCellSelected(room, dStr);
                            return (
                              <div key={idx}
                                className={[styles.cell, isWeekend ? styles.cellWeekend : '', isToday ? styles.cellToday : '', isSel ? styles.cellSelected : '', dStr < todayStr ? styles.cellPassado : styles.cellClickable].join(' ')}
                                style={{ width: DAY_CELL_W, height: ROOM_H, flexShrink: 0 }}
                                onClick={() => handleCellClick(room, dStr)}
                              />
                            );
                          })}
                          <div className={styles.barsLayer}>{renderBars(room)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
        </div>

      </div>

      <div ref={setSlotDir} className={styles.slotDireita} />
      </div>
      </div>
      {/* Modals */}
      {selectedReserva && isDesktop && <ReservaModal inline saindo={fechandoReserva} key={selectedReserva.id} reserva={selectedReserva} onClose={() => { setFechandoReserva(true); setTimeout(() => { setSelectedReserva(null); setDragEditValues(null); setFechandoReserva(false); }, 200); }} onCancel={handleCancelReserva} onActivate={handleActivateReserva} onMoverPernoite={handleMoverPernoite} onUpdate={handleUpdateReserva} onSync={handleSyncReserva} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} roomDescMap={roomDescMap} dragValues={dragEditValues} onApprove={handleApproveSolicitacao} onReject={handleRejectSolicitacao} onAusente={handleMarcarAusente} reservas={allReservas} />}
      {showCreateModal && (
        <CreateModal initialRoom={createInit.room} initialStart={createInit.start} initialEnd={createInit.end} initialAvailable={createInit.available}
          reservas={allReservas} onClose={() => setShowCreateModal(false)} onSave={handleSaveNew} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} roomDescMap={roomDescMap}
          initialGrupo={createInit.grupo ?? null} />
      )}
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
      {dayModal && (
        <DayModal dateStr={dayModal.dateStr} lista={diaSel.lista} loading={diaSel.loading} onClose={() => setDayModal(null)} categorias={categorias}
          onSelectReserva={(r) => setSelectedReserva(r)} />
      )}
      </JanelaCtx.Provider>
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
        {roomModal && <RoomModal room={roomModal.room} onClose={() => setRoomModal(null)} categorias={categorias} onSelectReserva={(r) => { if (!isDesktop) setRoomModal(null); setSelectedReserva(r); }} />}
      </JanelaCtx.Provider>
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
      {showGrupos && (
        <GruposModal
          key={grupoInicial ?? 'lista'}
          grupoInicial={grupoInicial}
          refreshKey={gruposRefreshKey}
          tiposPagamento={tiposPagamento}
          onClose={() => { setShowGrupos(false); setGrupoInicial(null); }}
          onNotify={notify}
          onSelectReserva={(r) => setSelectedReserva(r)}
          onNovaReservaGrupo={(grupoId, periodo) => {
            setShowGrupos(false);
            setGrupoInicial(null);
            setCreateInit({
              room: null,
              start: periodo?.dataInicio ?? null,
              end:   periodo?.dataFim    ?? null,
              available: null,
              grupo: grupoId,
            });
            setShowCreateModal(true);
          }}
        />
      )}
      </JanelaCtx.Provider>
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
      {statusModalFilter && (
        <StatusFilterModal
          status={statusModalFilter.key}
          label={statusModalFilter.label}
          onClose={() => setStatusModalFilter(null)}
          onSelectReserva={(r) => setSelectedReserva(r)}
        />
      )}
      </JanelaCtx.Provider>
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
      {showOrcamentos && (
        <OrcamentosModal
          onClose={() => setShowOrcamentos(false)}
          categorias={categorias}
          tiposPagamento={tiposPagamento}
          reservas={allReservas}
          roomDescMap={roomDescMap}
          onSave={handleSaveNew}
          onSelectReserva={(r) => setSelectedReserva(r)}
        />
      )}
      </JanelaCtx.Provider>
      <JanelaCtx.Provider value={isDesktop ? slotEsq : null}>
      {showSolicitacoes && (
        <SolicitacoesModal onClose={() => setShowSolicitacoes(false)}
          onSelectReserva={(r) => setSelectedReserva(r)} />
      )}
      </JanelaCtx.Provider>
      {selectedReserva && !isDesktop && <ReservaModal key={selectedReserva.id} reserva={selectedReserva} onClose={() => { setSelectedReserva(null); setDragEditValues(null); }} onCancel={handleCancelReserva} onActivate={handleActivateReserva} onMoverPernoite={handleMoverPernoite} onUpdate={handleUpdateReserva} onSync={handleSyncReserva} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} roomDescMap={roomDescMap} dragValues={dragEditValues} onApprove={handleApproveSolicitacao} onReject={handleRejectSolicitacao} onAusente={handleMarcarAusente} reservas={allReservas} />}

      {/* ── Multi-payment selection panel ── */}
      {pagamentoModoAtivo && (
        <div className={styles.selectionPanel}>
          <span className={styles.selectionCount}>
            <b>{reservasSelecionadas.size}</b>
            <span className={styles.selectionCountSub}>
              {' '}{tr('reserva')}{reservasSelecionadas.size !== 1 ? 's' : ''} {tr('selecionada')}{reservasSelecionadas.size !== 1 ? 's' : ''}
            </span>
          </span>
          <button
            className={styles.selectionBtnPrimary}
            disabled={reservasSelecionadas.size === 0 || pagMultiploSaving}
            onClick={() => setShowPagMultiploModal(true)}
          >
            <DollarSign size={13} />
            {tr('Adicionar Pagamento')}
          </button>
          <button className={styles.selectionBtnCancel} onClick={exitSelectionMode}>
            <X size={13} />
            {tr('Cancelar')}
          </button>
        </div>
      )}

      {/* Por quarto: seleção do quarto + pagamento lado a lado */}
      {showPagQuartoPicker && (() => {
        const ladoALado = pagQuartoAlvo != null && showPagMultiploModal;
        return (
        <Modal open onClose={exitSelectionMode} size="sm"
          title={<><DollarSign size={15} /> {tr('Selecione o quarto')}</>}
          containerStyle={ladoALado && winWide
            ? { transform: 'translateX(calc(-50% - 10px))', transition: 'transform 0.25s cubic-bezier(0.2,0.8,0.2,1)' }
            : (ladoALado ? { marginTop: 'clamp(8px, 3vh, 24px)' } : undefined)}
          backdropStyle={ladoALado && !winWide ? { alignItems: 'flex-start' } : undefined}  /* lista de quartos em cima */
          footer={<div className={styles.footerRight}><Button variant="secondary" onClick={exitSelectionMode}>{tr('Fechar')}</Button></div>}
        >
          <div className={styles.dayRoomList}>
            {allReservas.filter((r) => reservasSelecionadas.has(r.id)).map((r) => {
              const pendente = Math.max(0, (r.valorTotal ?? 0) - (r.totalPago ?? 0));
              const alvo = pagQuartoAlvo?.id === r.id;
              return (
                <div key={r.id}
                  className={styles.dayRoomRow}
                  style={alvo ? { outline: '2px solid var(--violet)', outlineOffset: '-1px' } : undefined}
                  onClick={() => { setPagQuartoAlvo(r); setShowPagMultiploModal(true); }}>
                  <div className={[styles.dayRoomBadge, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                  <div className={styles.searchDropInfo}>
                    <div className={styles.searchDropName}>{r.titularNome}</div>
                    <div className={styles.searchDropMeta}>{tr('Total')} {fmtBRL(r.valorTotal)} {tr('· Pendente')} {fmtBRL(pendente)}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: alvo ? 'var(--violet)' : 'var(--text-2)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </Modal>
        );
      })()}

      <PaymentModal
        key={pagQuartoAlvo?.id ?? 'multi'}
        open={showPagMultiploModal}
        onClose={() => { setShowPagMultiploModal(false); setPagQuartoAlvo(null); }}
        onConfirm={handlePagamentoMultiplo}
        tiposPagamento={tiposPagamento}
        isSubmitting={pagMultiploSaving}
        canAplicarDesconto={false}
        canDespesaPessoal={false}
        titularNome={pagQuartoAlvo ? pagQuartoAlvo.titularNome : null}
        quartoNumero={pagQuartoAlvo ? fmtRoom(pagQuartoAlvo.quarto) : null}
        lastPayerName={pagQuartoAlvo
          ? ((pagQuartoAlvo.pagamentos ?? []).filter((p) => !p.cancelado).at(-1)?.nomePagador ?? null)
          : pagMultiploLastPayer}
        valorTotal={pagQuartoAlvo ? (pagQuartoAlvo.valorTotal ?? 0) : pagMultiploValorTotal}
        valorPago={pagQuartoAlvo ? (pagQuartoAlvo.totalPago ?? 0) : pagMultiploValorPago}
        containerStyle={pagQuartoAlvo
          ? (winWide
              ? { transform: 'translateX(calc(50% + 10px))', animation: 'none', pointerEvents: 'auto' }
              : { marginBottom: 'clamp(8px, 3vh, 24px)', pointerEvents: 'auto' })
          : undefined}
        backdropStyle={pagQuartoAlvo
          ? (winWide
              ? { background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', pointerEvents: 'none' }
              : { background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', pointerEvents: 'none', alignItems: 'flex-end' })  /* pagamento embaixo */
          : undefined}
      />

      {escolhaGrupo && (
        <Balao anchor={escolhaGrupo.anchor} onClose={() => setEscolhaGrupo(null)}>
          <p className={styles.balaoMsg}>
            {tr('Reserva em grupo')} · <b>{escolhaGrupo.reserva.titularNome}</b>
          </p>
          <div className={styles.balaoAcoes}>
            <button type="button" className={styles.balaoBtn}
              onClick={() => {
                const gid = escolhaGrupo.reserva.grupo_id;
                setEscolhaGrupo(null);
                setSelectedReserva(null);
                setGrupoInicial(gid);
                setShowGrupos(true);
              }}>
              {tr('Ver grupo')}
            </button>
            <button type="button" className={[styles.balaoBtn, styles.balaoBtnOk].join(' ')}
              onClick={() => { const r = escolhaGrupo.reserva; setEscolhaGrupo(null); setSelectedReserva(r); }}>
              {tr('Ver reserva')}
            </button>
          </div>
        </Balao>
      )}

      {/* ── Floating action panel ── */}
      {!isDesktop && !selectedReserva && !showCreateModal && !showOrcamentos && !showSolicitacoes && !showGrupos && !dayModal && !showMonthPicker && !roomModal && !pagamentoModoAtivo && <div className={styles.floatPanel}>
        <button className={[styles.floatBtn, styles.floatBtnPrimary].join(' ')} onClick={() => { setCreateInit({ room: null, start: null, end: null, available: null }); setShowCreateModal(true); }}>
          <Plus size={15} />
          <span>{tr('Nova Reserva')}</span>
        </button>

        {/* Mobile-only toggle */}
        <button
          className={[styles.floatBtn, styles.floatToggleMobile, floatExpanded ? styles.floatBtnActive : ''].join(' ')}
          onClick={() => setFloatExpanded((v) => !v)}
        >
          {floatExpanded ? <X size={14} /> : <SlidersHorizontal size={14} />}
          <span>{floatExpanded ? tr('Fechar') : tr('Mais opções')}</span>
        </button>

        {/* Secondary buttons — always visible on desktop, toggled on mobile */}
        <div className={[styles.floatSecondary, floatExpanded ? styles.floatSecondaryOpen : ''].join(' ')}>
          <div className={styles.floatDivider} />

          <div className={styles.floatBtnWrap} ref={statusFilterRef}>
            <button
              className={[styles.floatBtn, showStatusFilter ? styles.floatBtnActive : ''].join(' ')}
              onClick={() => setShowStatusFilter((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              <span>{tr('Filtrar Status')}</span>
            </button>
            {showStatusFilter && (
              <div className={styles.floatFilterDrop}>
                {STATUS_FILTER_OPTIONS.map(([key, label]) => (
                  <button key={key} className={styles.floatFilterRow}
                    onClick={() => { setStatusModalFilter({ key, label }); setShowStatusFilter(false); }}>
                    <span className={[styles.statusDot, styles[`status_${key}`]].join(' ')} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.floatDivider} />

          <div className={styles.floatBtnWrap}>
            <button className={styles.floatBtn} onClick={() => setShowOrcamentos(true)}>
              <FileText size={15} />
              <span>{tr('Orçamentos')}</span>
            </button>
          </div>

          <div className={styles.floatBtnWrap}>
            <button className={styles.floatBtn} onClick={() => setShowSolicitacoes(true)}>
              <Bell size={15} />
              <span>{tr('Solicitações')}</span>
              {solicitadasCount > 0 && <span className={styles.floatBadge}>{solicitadasCount}</span>}
            </button>
          </div>
        </div>
      </div>}
    </div>
    </JanelaCtx.Provider>
    </JanelaDirCtx.Provider>
  );
}

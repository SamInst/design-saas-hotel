// ─────────────────────────────────────────────────────────────
//  financeiroReport.js
//  Geração de relatórios PDF do Financeiro via impressão do navegador.
//
//  Estratégia: monta um documento HTML leve (texto vetorial + ícones SVG
//  inline) dentro de um iframe oculto e dispara window.print(). O usuário
//  escolhe "Salvar como PDF". Como não há captura de imagem (html2canvas),
//  o arquivo gerado é pequeno, o texto continua selecionável e o layout
//  reproduz a tela do Financeiro (KPIs, distribuição, grupos por dia).
// ─────────────────────────────────────────────────────────────

const brl = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Paleta / acentos (idênticos ao FinancialDashboard) ───────────────────────
const ACCENT = {
  sky:     { fg: '#0284c7', bg: 'rgba(2,132,199,0.12)',   bar: '#0ea5e9' },
  violet:  { fg: '#7c3aed', bg: 'rgba(124,58,237,0.12)',  bar: '#7c3aed' },
  indigo:  { fg: '#6366f1', bg: 'rgba(99,102,241,0.12)',  bar: '#6366f1' },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.12)',   bar: '#10b981' },
  fuchsia: { fg: '#c026d3', bg: 'rgba(192,38,211,0.12)',  bar: '#d946ef' },
  amber:   { fg: '#d97706', bg: 'rgba(217,119,6,0.12)',   bar: '#f59e0b' },
  slate:   { fg: '#6b7280', bg: 'rgba(107,114,128,0.12)', bar: '#64748b' },
};

const accentOf = (d = '') => {
  const u = (d ?? '').toUpperCase();
  if (u.includes('PIX'))                              return 'sky';
  if (u.includes('CREDITO') || u.includes('CRÉDITO')) return 'violet';
  if (u.includes('DEBITO')  || u.includes('DÉBITO'))  return 'indigo';
  if (u.includes('DINHEIRO'))                         return 'emerald';
  if (u.includes('NUBANK'))                           return 'fuchsia';
  if (u.includes('TRANSFER'))                         return 'amber';
  if (u.includes('PENDENTE'))                         return 'slate';
  return 'violet';
};
const corMetodo = (m) => ACCENT[accentOf(m)].bar;

// ── Ícones (mesmos traços do lucide-react usado na tela) ─────────────────────
const PATHS = {
  arrowUpRight:   '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  arrowDownRight: '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>',
  minus:          '<line x1="5" y1="12" x2="19" y2="12"/>',
  wallet:         '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>',
  banknote:       '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>',
  calendar:       '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  smartphone:     '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  creditCard:     '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  building:       '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><line x1="10" y1="6" x2="14" y2="6"/><line x1="10" y1="10" x2="14" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="10" y1="18" x2="14" y2="18"/>',
  clock:          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  tag:            '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
};

const ico = (nome, size = 14, sw = 2) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"
   >${PATHS[nome] ?? ''}</svg>`;

// Mesmo mapeamento do <PayMethodIcon /> da tela.
function icoMetodo(descricao = '', size = 14) {
  const d = (descricao ?? '').toUpperCase();
  if (d.includes('PIX'))                              return ico('smartphone', size);
  if (d.includes('CREDITO') || d.includes('CRÉDITO')) return ico('creditCard', size);
  if (d.includes('DEBITO')  || d.includes('DÉBITO'))  return ico('creditCard', size);
  if (d.includes('DINHEIRO'))                         return ico('banknote', size);
  if (d.includes('NUBANK'))                           return ico('smartphone', size);
  if (d.includes('TRANSFER'))                         return ico('building', size);
  if (d.includes('PENDENTE'))                         return ico('clock', size);
  return ico('wallet', size);
}

// Valor final do lançamento, replicando a regra de desconto da tela.
function valorLancamento(t) {
  const bruto = Math.abs(t.pagamento?.valor ?? t.valor ?? 0);
  const d = t.pagamento?.desconto;
  const final = d
    ? bruto - (d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0))
    : bruto;
  return { final, temDesconto: !!d, isExp: (t.valor ?? 0) < 0 };
}

// A busca da tela filtra os itens em `_items`; sem busca cai nos `relatorios`.
const itensDoGrupo = (g) => g?._items ?? g?.relatorios ?? [];

// ── CSS: mesma linguagem visual do FinancialDashboard.module.css ─────────────
// Só texto, bordas e SVG inline → PDF leve e com texto selecionável.
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600&display=swap');

  * { box-sizing: border-box; }
  @page { size: A4; margin: 11mm 10mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px; line-height: 1.4; color: #111827;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ico { display: block; flex-shrink: 0; }
  b, strong { font-weight: 700; }

  /* ── Cabeçalho do documento ── */
  .head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    border-bottom: 2px solid #7c3aed; padding-bottom: 9px; margin-bottom: 14px;
  }
  .brand {
    font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
    color: #7c3aed; margin-bottom: 3px;
  }
  .head h1 { font-size: 19px; font-weight: 700; margin: 0; letter-spacing: -.01em; }
  .head .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .emit { text-align: right; font-size: 10px; color: #9ca3af; line-height: 1.5; flex-shrink: 0; }
  .emit b { display: block; color: #6b7280; font-weight: 600; }

  /* ── KPIs (espelha .kpi da tela) ── */
  .kpiRow { display: flex; gap: 8px; margin-bottom: 12px; }
  .kpi {
    flex: 1; min-width: 0; position: relative; overflow: hidden;
    border: 1px solid #e2e6ef; border-radius: 12px;
    padding: 11px 11px 12px; background: #fff;
  }
  .kpi .accentBar { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .kpiTop { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; }
  .kpiIcon {
    width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .kpiLabel {
    font-size: 8px; font-weight: 700; letter-spacing: .07em;
    text-transform: uppercase; color: #6b7280; line-height: 1.2;
  }
  .kpiValue {
    font-family: 'Fraunces', Georgia, serif; font-weight: 600;
    font-size: 16px; line-height: 1; letter-spacing: -.02em; color: #111827;
    font-variant-numeric: tabular-nums;
  }
  .kpiNeg { color: #e11d48; }
  .kpiFoot { display: block; font-size: 8.5px; font-weight: 600; color: #9ca3af; margin-top: 5px; }

  /* ── Distribuição por forma de pagamento ── */
  .dist {
    border: 1px solid #e2e6ef; border-radius: 12px;
    padding: 11px 13px 12px; margin-bottom: 12px; background: #fff;
  }
  .distHead {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px; margin-bottom: 9px;
  }
  .distTitle {
    font-size: 9px; font-weight: 700; letter-spacing: .07em;
    text-transform: uppercase; color: #6b7280;
  }
  .distPeriodo { font-size: 10px; font-weight: 600; color: #6b7280; flex-shrink: 0; }
  .distBar {
    display: flex; gap: 2px; height: 9px; border-radius: 999px;
    overflow: hidden; background: #f6f8fc;
  }
  .distSeg { border-radius: 3px; min-width: 3px; }
  .distLegend {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 20px; margin-top: 10px;
  }
  .distChip { display: flex; align-items: center; gap: 6px; font-size: 10px; min-width: 0; }
  .distDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .distName {
    color: #6b7280; flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* Contador de lançamentos: logo após o ponto colorido, sem fundo.
     min-width fixo mantém os nomes das formas alinhados na coluna. */
  .distCount {
    min-width: 11px; text-align: right; flex-shrink: 0;
    font-size: 9px; font-weight: 700; color: #6b7280;
    font-variant-numeric: tabular-nums;
  }
  .distVal { color: #111827; font-weight: 700; flex-shrink: 0; font-variant-numeric: tabular-nums; }

  /* ── Cash hero (quando só há permissão do card de dinheiro) ── */
  .cashHero {
    display: flex; align-items: center; gap: 16px;
    padding: 14px 18px; border-radius: 14px; margin-bottom: 12px;
    background: linear-gradient(135deg, #064e3b 0%, #065f46 48%, #047857 100%);
    color: #ecfdf5;
  }
  .cashIcon {
    width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; color: #fff;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22);
  }
  .cashLabel {
    font-size: 9px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: rgba(236,253,245,0.72);
  }
  .cashSub { display: flex; gap: 16px; font-size: 10.5px; font-weight: 500; margin-top: 6px; }
  .cashUp   { color: #a7f3d0; display: inline-flex; align-items: center; gap: 4px; }
  .cashDown { color: #fda4af; display: inline-flex; align-items: center; gap: 4px; }
  .cashValue {
    margin-left: auto; flex-shrink: 0;
    font-family: 'Fraunces', Georgia, serif; font-weight: 600;
    font-size: 24px; line-height: 1; letter-spacing: -.02em;
    font-variant-numeric: tabular-nums;
  }

  /* ── Barra de filtros aplicados ── */
  .filtros { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 12px; }
  .filtrosTitle { font-size: 10px; font-weight: 700; color: #dc2626; }
  .chip {
    display: inline-flex; align-items: baseline; gap: 5px;
    padding: 3px 9px; border-radius: 6px; font-size: 10px; line-height: 1.3;
    background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25);
  }
  .chip .k { color: #dc2626; font-weight: 600; }
  .chip .v { color: #b91c1c; font-weight: 700; }

  /* ── Grupo do dia (espelha .group da tela) ── */
  .group {
    border: 1px solid #e2e6ef; border-radius: 10px;
    overflow: hidden; margin-bottom: 12px;
  }
  .groupHeader {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;
    background: #f6f8fc; border-bottom: 1px solid #e2e6ef; padding: 8px 11px;
    break-after: avoid; page-break-after: avoid;
  }
  .groupLeft { display: flex; align-items: center; gap: 7px; }
  .groupDate { font-size: 12px; font-weight: 700; color: #111827; }
  .badge {
    font-size: 9px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
    background: rgba(124,58,237,0.10); border: 1px solid rgba(124,58,237,0.18); color: #7c3aed;
  }
  .groupRight { display: flex; flex-direction: column; gap: 2px; min-width: 190px; flex-shrink: 0; }
  .groupStat { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .groupStatLabel { font-size: 9.5px; font-weight: 500; color: #6b7280; white-space: nowrap; }
  .groupStat b { font-size: 10.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* ── Tabela de lançamentos ── */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  thead th {
    font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
    color: #6b7280; text-align: left; padding: 5px 11px;
    background: #f6f8fc; border-bottom: 1px solid #e2e6ef;
  }
  tbody td {
    padding: 7px 11px; border-bottom: 1px solid #eef1f6;
    vertical-align: top; color: #111827;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { page-break-inside: avoid; break-inside: avoid; }
  .cIco { width: 34px; }
  .cVal { width: 108px; text-align: right; }
  .cSaldo { width: 104px; text-align: right; }

  .methodIcon {
    width: 22px; height: 22px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
  }
  .desc { font-size: 11px; font-weight: 600; color: #111827; word-break: break-word; }
  .subdesc {
    font-size: 9px; color: #6b7280; margin-top: 2px;
    display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
  }
  .editadoTag { color: #dc2626; font-weight: 700; margin-right: 4px; }
  .pessoalTag {
    font-size: 8px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
    background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.20);
  }
  .valor {
    display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px;
    font-size: 11px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .saldo {
    display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px;
    font-size: 10.5px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .vazio { color: #9ca3af; text-align: center; padding: 14px; font-size: 10px; }

  .pos { color: #059669; } .neg { color: #ef4444; }
  .desconto { color: #d97706; }
  .muted { color: #6b7280; }
  .neutro { color: #374151; }

  /* ── Rodapé ── */
  .foot {
    margin-top: 16px; padding-top: 7px; border-top: 1px solid #e2e6ef;
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 8.5px; color: #9ca3af;
  }
`;

// ── Blocos ───────────────────────────────────────────────────────────────────

function kpiCard({ label, valor, accent, gradiente, icone, negativo = false, rodape = '' }) {
  return `
    <div class="kpi">
      <div class="accentBar" style="background:linear-gradient(90deg,${gradiente[0]},${gradiente[1]})"></div>
      <div class="kpiTop">
        <span class="kpiIcon" style="background:${accent.bg};color:${accent.fg}">${icone}</span>
        <span class="kpiLabel">${escapeHtml(label)}</span>
      </div>
      <div class="kpiValue${negativo ? ' kpiNeg' : ''}">${valor}</div>
      ${rodape ? `<span class="kpiFoot">${escapeHtml(rodape)}</span>` : ''}
    </div>`;
}

function blocoKpis({ total, caixa, mostrarCaixa }) {
  const lucro = total.lucro ?? 0;
  const margem = total.receitas > 0
    ? `Margem de ${Math.round((lucro / total.receitas) * 100)}%`
    : '';
  return `
    <section class="kpiRow">
      ${kpiCard({
        label: 'Receita total', valor: brl(total.receitas),
        accent: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
        gradiente: ['#10b981', '#34d399'], icone: ico('arrowUpRight', 13),
      })}
      ${kpiCard({
        label: 'Despesa total', valor: brl(Math.abs(total.despesas ?? 0)),
        accent: { bg: 'rgba(244,63,94,0.12)', fg: '#f43f5e' },
        gradiente: ['#f43f5e', '#fb7185'], icone: ico('arrowDownRight', 13),
      })}
      ${kpiCard({
        label: 'Lucro', valor: brl(lucro), negativo: lucro < 0,
        accent: { bg: 'rgba(124,58,237,0.14)', fg: '#7c3aed' },
        gradiente: ['#7c3aed', '#a78bfa'], icone: ico('wallet', 13),
        rodape: margem,
      })}
      ${mostrarCaixa ? kpiCard({
        label: 'Saldo do caixa', valor: brl(caixa.lucro ?? 0), negativo: (caixa.lucro ?? 0) < 0,
        accent: { bg: 'rgba(5,150,105,0.13)', fg: '#059669' },
        gradiente: ['#047857', '#34d399'], icone: ico('banknote', 13),
        rodape: 'Dinheiro em espécie',
      }) : ''}
    </section>`;
}

// Banner verde exibido na tela quando o usuário só tem o card de dinheiro.
function blocoCaixaHero(caixa) {
  return `
    <section class="cashHero">
      <span class="cashIcon">${ico('banknote', 19)}</span>
      <div>
        <div class="cashLabel">Saldo em caixa · Dinheiro</div>
        <div class="cashSub">
          <span class="cashUp">${ico('arrowUpRight', 11)} Entradas ${brl(caixa.receitas)}</span>
          <span class="cashDown">${ico('arrowDownRight', 11)} Saídas ${brl(Math.abs(caixa.despesas ?? 0))}</span>
        </div>
      </div>
      <div class="cashValue">${brl(caixa.lucro)}</div>
    </section>`;
}

function blocoDistribuicao(entries, totalReceitas, periodo) {
  if (!entries.length) return '';
  const segmentos = entries.map(([m, v]) => {
    const pct = totalReceitas > 0 ? (v.receitas / totalReceitas) * 100 : 0;
    if (pct <= 0) return '';
    return `<div class="distSeg" style="width:${pct}%;background:${corMetodo(m)}"></div>`;
  }).join('');

  const legenda = entries.map(([m, v]) => `
    <div class="distChip">
      <span class="distDot" style="background:${corMetodo(m)}"></span>
      <span class="distCount">${v.amount ?? 0}</span>
      <span class="muted">${icoMetodo(m, 11)}</span>
      <span class="distName">${escapeHtml(m)}</span>
      <b class="distVal">${brl(v.receitas)}</b>
    </div>`).join('');

  return `
    <section class="dist">
      <div class="distHead">
        <span class="distTitle">Receita por forma de pagamento</span>
        ${periodo ? `<span class="distPeriodo">${escapeHtml(periodo)}</span>` : ''}
      </div>
      <div class="distBar">${segmentos}</div>
      <div class="distLegend">${legenda}</div>
    </section>`;
}

function blocoFiltros(filtros) {
  if (!filtros.length) return '';
  return `
    <section class="filtros">
      <span class="filtrosTitle">Filtros aplicados:</span>
      ${filtros.map(f => `
        <span class="chip">
          <span class="k">${escapeHtml(f.label)}:</span>
          <span class="v">${escapeHtml(f.value)}</span>
        </span>`).join('')}
    </section>`;
}

function linhaLancamento(t, { saldo: mostrarSaldo }) {
  const { final, temDesconto, isExp } = valorLancamento(t);
  const metodo = t.pagamento?.tipo_pagamento?.descricao;
  const acc    = ACCENT[accentOf(metodo)];
  const saldo  = t.valor_historico_dinheiro ?? 0;

  const corValor = temDesconto ? 'desconto' : isExp ? 'neg' : '';
  const estilo   = temDesconto || isExp ? '' : ` style="color:${acc.fg}"`;

  const seta = saldo > 0
    ? `<span class="pos">${ico('arrowUpRight', 10)}</span>`
    : saldo < 0
    ? `<span class="neg">${ico('arrowDownRight', 10)}</span>`
    : `<span class="muted">${ico('minus', 10)}</span>`;

  return `
    <tr>
      <td class="cIco">
        <span class="methodIcon" style="background:${acc.bg};color:${acc.fg}">${icoMetodo(metodo, 12)}</span>
      </td>
      <td>
        <div class="desc">
          ${t.editado ? '<span class="editadoTag">(Editado)</span>' : ''}${escapeHtml(t.relatorio ?? '—')}
        </div>
        <div class="subdesc">
          <span>${escapeHtml(t.data_hora_registro ?? '—')} · ${escapeHtml(metodo ?? '—')}</span>
          ${t.despesa_pessoal ? '<span class="pessoalTag">Despesa Interna</span>' : ''}
        </div>
      </td>
      <td class="cVal">
        <b class="valor ${corValor}"${estilo}>
          ${isExp ? '−' : '+'}${brl(final)}${temDesconto ? ico('tag', 11) : ''}
        </b>
      </td>
      ${mostrarSaldo ? `
      <td class="cSaldo">
        <span class="saldo">${brl(saldo)}${seta}</span>
      </td>` : ''}
    </tr>`;
}

function blocoDia(g, perm) {
  const itens = itensDoGrupo(g);
  const lucro = g.lucro_total_dia ?? 0;
  const nCols = perm.saldo ? 4 : 3;

  const corpo = itens.length
    ? itens.map(t => linhaLancamento(t, perm)).join('')
    : `<tr><td class="vazio" colspan="${nCols}">Sem lançamentos.</td></tr>`;

  return `
    <section class="group">
      <div class="groupHeader">
        <div class="groupLeft">
          <span style="color:#7c3aed">${ico('calendar', 12)}</span>
          <span class="groupDate">${escapeHtml(g.data ?? '—')}</span>
          <span class="badge">${itens.length} ${itens.length === 1 ? 'lançamento' : 'lançamentos'}</span>
        </div>
        ${perm.totaisDia ? `
        <div class="groupRight">
          <div class="groupStat">
            <span class="groupStatLabel">Receita total do dia:</span>
            <b class="neutro">${brl(g.total_entrada_dia)}</b>
          </div>
          <div class="groupStat">
            <span class="groupStatLabel">Total de despesas:</span>
            <b class="neg">${brl(g.total_saida_dia)}</b>
          </div>
          <div class="groupStat">
            <span class="groupStatLabel">Lucro do dia:</span>
            <b class="${lucro >= 0 ? 'pos' : 'neg'}">${brl(lucro)}</b>
          </div>
        </div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th class="cIco"></th>
            <th>Descrição</th>
            <th class="cVal">Valor</th>
            ${perm.saldo ? '<th class="cSaldo">Saldo Dinheiro</th>' : ''}
          </tr>
        </thead>
        <tbody>${corpo}</tbody>
      </table>
    </section>`;
}

// ── Documento + impressão ────────────────────────────────────────────────────

function documento({ titulo, subtitulo, usuario, corpoHtml }) {
  const agora = new Date();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${escapeHtml(titulo)}</title><style>${CSS}</style></head>
    <body>
      <header class="head">
        <div>
          <div class="brand">Isto é Pousada</div>
          <h1>${escapeHtml(titulo)}</h1>
          ${subtitulo ? `<div class="sub">${escapeHtml(subtitulo)}</div>` : ''}
        </div>
        <div class="emit">
          <b>Emitido em</b>${escapeHtml(agora.toLocaleString('pt-BR'))}
          ${usuario ? `<b style="margin-top:3px">Por</b>${escapeHtml(usuario)}` : ''}
        </div>
      </header>
      ${corpoHtml}
      <footer class="foot">
        <span>Isto é Pousada · Relatório financeiro</span>
        <span>${escapeHtml(agora.toLocaleDateString('pt-BR'))}</span>
      </footer>
    </body></html>`;
}

function imprimir(html, fallbackTitulo) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  });
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = fallbackTitulo;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  let removido = false;
  const limpar = () => {
    if (removido) return;
    removido = true;
    setTimeout(() => iframe.remove(), 500);
  };
  win.onafterprint = limpar;

  let impresso = false;
  const disparar = () => {
    if (impresso) return;
    impresso = true;
    win.focus();
    win.print();
    // fallback: remove o iframe mesmo se onafterprint não disparar
    setTimeout(limpar, 60000);
  };

  // Espera as fontes (DM Sans / Fraunces) para o layout não mudar depois do print;
  // o timer garante a impressão mesmo se o carregamento demorar.
  doc.fonts?.ready?.then(() => setTimeout(disparar, 60)).catch(() => {});
  setTimeout(disparar, 1200);
}

// ── API pública ──────────────────────────────────────────────────────────────

const permissoesPadrao = (p = {}) => ({
  saldo:     p.saldo     ?? true,
  totaisDia: p.totaisDia ?? true,
  dashboard: p.dashboard ?? true,
  caixa:     p.caixa     ?? true,
});

// A API só devolve o mapa de pagamentos do período inteiro; para o relatório de
// um dia a distribuição é somada a partir dos próprios lançamentos daquele dia,
// no mesmo formato { receitas, despesas, lucro, amount } usado pela tela.
function pagamentosDoDia(itens) {
  const mapa = new Map();
  itens.forEach((t) => {
    const metodo = t.pagamento?.tipo_pagamento?.descricao ?? '—';
    const { final, isExp } = valorLancamento(t);
    const acc = mapa.get(metodo) ?? { receitas: 0, despesas: 0, lucro: 0, amount: 0 };
    if (isExp) acc.despesas -= final;
    else       acc.receitas += final;
    acc.lucro   = acc.receitas + acc.despesas;
    acc.amount += 1;
    mapa.set(metodo, acc);
  });
  return [...mapa.entries()].sort((a, b) => b[1].receitas - a[1].receitas);
}

// Relatório de um único dia — reproduz o grupo do dia como aparece na tela.
export function relatorioDiaPdf(grupo, { permissoes, usuario } = {}) {
  if (!grupo) return;
  const perm  = permissoesPadrao(permissoes);
  const itens = itensDoGrupo(grupo);

  const entries  = pagamentosDoDia(itens);
  const receitas = entries.reduce((soma, [, v]) => soma + v.receitas, 0);
  const distribuicao = perm.dashboard
    ? blocoDistribuicao(entries, receitas, `Total de transações: ${itens.length} · ${grupo.data ?? ''}`)
    : '';

  const html = documento({
    titulo: 'Relatório Diário',
    subtitulo: grupo.data,
    usuario,
    corpoHtml: distribuicao + blocoDia(grupo, perm),
  });
  imprimir(html, `Relatório ${grupo.data ?? ''}`);
}

// Relatório da busca filtrada — KPIs + distribuição + filtros + todos os dias.
export function relatorioFiltroPdf({
  grupos = [], total, pagamentos = {}, filtros = [], periodo = '', permissoes, usuario,
} = {}) {
  const perm = permissoesPadrao(permissoes);
  const tot  = total ?? { receitas: 0, despesas: 0, lucro: 0 };
  const entries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');
  const caixa = entries.find(([m]) => m.toUpperCase().includes('DINHEIRO'))?.[1]
    ?? { receitas: 0, despesas: 0, lucro: 0 };

  // aceita tanto a lista de filtros da tela quanto uma string simples
  const listaFiltros = Array.isArray(filtros)
    ? filtros
    : filtros ? [{ label: 'Filtros', value: filtros }] : [];

  const cabecalho = perm.dashboard
    ? blocoKpis({ total: tot, caixa, mostrarCaixa: perm.caixa }) +
      blocoDistribuicao(entries, tot.receitas ?? 0, periodo)
    : perm.caixa
      ? blocoCaixaHero(caixa)
      : '';

  const corpo = grupos.length
    ? grupos.map(g => blocoDia(g, perm)).join('')
    : '<p class="vazio" style="padding:24px">Nenhum lançamento no período filtrado.</p>';

  const html = documento({
    titulo: 'Relatório Financeiro',
    subtitulo: listaFiltros.map(f => `${f.label}: ${f.value}`).join(' · ') || 'Busca filtrada',
    usuario,
    corpoHtml: cabecalho + blocoFiltros(listaFiltros) + corpo,
  });
  imprimir(html, 'Relatório Financeiro');
}

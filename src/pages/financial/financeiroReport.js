import { tr, locale } from '../../i18n';
import icoPix           from '../../assets/pagamento/pix.png';
import icoCartao        from '../../assets/pagamento/cartao.png';
import icoDinheiro      from '../../assets/pagamento/dinheiro.png';
import icoTransferencia from '../../assets/pagamento/transferencia.png';
import icoLink          from '../../assets/pagamento/link.png';
import icoBoleto        from '../../assets/pagamento/boleto.png';
// ─────────────────────────────────────────────────────────────
//  financeiroReport.js
//  Geração de relatórios PDF do Financeiro via impressão do navegador.
//
//  Estratégia: monta um documento HTML leve dentro de um iframe oculto e
//  dispara window.print(). O usuário escolhe "Salvar como PDF". O texto
//  continua selecionável e o layout segue a tela do Financeiro: cabeçalho
//  escuro do dia, caixas de totais e o extrato com linha do tempo.
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

// ── Cores das formas de pagamento (idênticas ao FinancialDashboard) ─────────
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
const ACCENT_HEX = {
  sky: '#1b9a8c', violet: '#5b5bd6', indigo: '#3a7bc8', emerald: '#2f8a57',
  fuchsia: '#9046c4', amber: '#c08a1e', slate: '#8a94a6',
};
const corMetodo = (m) => ACCENT_HEX[accentOf(m)];

// Mesmos ícones do extrato na tela. Pendente fica com o relógio.
const imgMetodo = (desc) => {
  const d = (desc ?? '').toUpperCase();
  if (d.includes('PENDENTE')) return null;
  return d.includes('PIX') ? icoPix
    : /CART|CR[EÉ]DITO|D[EÉ]BITO/.test(d) ? icoCartao
    : /DINHEIRO|ESP[EÉ]CIE/.test(d) ? icoDinheiro
    : /TRANSFER|TED|DOC|NUBANK/.test(d) ? icoTransferencia
    : /LINK/.test(d) ? icoLink
    : icoBoleto;
};

// ── Ícones (mesmos traços do lucide-react usado na tela) ─────────────────────
const PATHS = {
  arrowUpRight:   '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  arrowDownRight: '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>',
  trendingUp:     '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  trendingDown:   '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  banknote:       '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>',
  clock:          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  tag:            '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
};

const ico = (nome, size = 14, sw = 2) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"
   >${PATHS[nome] ?? ''}</svg>`;

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

const horaDe = (s) => (s ?? '').split(' ')[1] ?? '—';
const parseDia = (s) => { const [d, m, y] = (s ?? '').split('/').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const diaSemana = (s) => parseDia(s).toLocaleDateString(locale(), { weekday: 'long' });

// Saldo do caixa ao fim do dia: o saldo em dinheiro do último lançamento.
function saldoFechamento(g) {
  const lista = (g?.relatorios ?? itensDoGrupo(g)).filter(t => t.valor_historico_dinheiro != null);
  if (!lista.length) return null;
  const ultimo = lista.reduce((a, t) => (horaDe(t.data_hora_registro) > horaDe(a.data_hora_registro) ? t : a));
  return ultimo.valor_historico_dinheiro;
}

// ── CSS: mesma linguagem visual do FinancialDashboard.module.css ─────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }
  @page { size: A4; margin: 12mm 11mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 10.5px; line-height: 1.45; color: #1c2333;
    font-feature-settings: 'tnum';
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ico { display: block; flex-shrink: 0; }

  /* ── Cabeçalho do documento ── */
  .head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    padding-bottom: 10px; margin-bottom: 14px; border-bottom: 1px solid #dde2ec;
  }
  .brand { font-size: 10px; font-weight: 600; color: #6b7487; margin-bottom: 2px; }
  .head h1 { font-size: 18px; line-height: 1.2; font-weight: 650; margin: 0; letter-spacing: -.01em; }
  .head .sub { font-size: 10.5px; color: #6b7487; margin-top: 3px; }
  .emit { text-align: right; font-size: 9.5px; color: #6b7487; line-height: 1.5; flex-shrink: 0; }
  .emit b { color: #1c2333; font-weight: 600; }

  /* ── Cabeçalho escuro (dia ou período) ── */
  .hero {
    border-radius: 6px; background: #1f2a40; color: #f3f5fa;
    padding: 14px 16px 0; overflow: hidden; margin-bottom: 10px;
    break-inside: avoid; page-break-inside: avoid;
  }
  .heroTopo { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 14px; }
  .heroRot { font-size: 10px; color: #a7b0c2; }
  .heroRot::first-letter { text-transform: uppercase; }
  .heroNome { margin: 2px 0 0; font-size: 17px; line-height: 1.2; font-weight: 650; letter-spacing: -.01em; }
  .caixa {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 8px 14px; border-radius: 5px; background: #1d5e45; min-width: 150px;
  }
  .caixaRot { display: inline-flex; align-items: center; gap: 5px; font-size: 9.5px; color: #cbead9; }
  .caixaVal { margin-top: 2px; font-size: 17px; line-height: 1.2; font-weight: 650; color: #fff; white-space: nowrap; }
  .linhaTot { display: flex; margin: 0 -16px; border-top: 1px solid #36425c; }
  .linhaTot div {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 10px; font-size: 10px;
  }
  .linhaTot div + div { border-left: 1px solid #36425c; }
  .linhaTot span { color: #a7b0c2; }
  .linhaTot b { font-size: 11.5px; font-weight: 650; white-space: nowrap; }
  .hIn { color: #7ee2ad; } .hOut { color: #f7a8a4; }

  /* ── Cabeçalho do dia em uma linha ── */
  .heroLinha {
    display: flex; align-items: stretch; margin-bottom: 8px;
    border-radius: 6px; background: #1f2a40; color: #f3f5fa; overflow: hidden;
    break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid;
  }
  .heroLinha > div {
    flex: 1 1 auto; display: flex; align-items: center; justify-content: center; gap: 5px;
    padding: 8px 10px; font-size: 9.5px; white-space: nowrap;
  }
  .heroLinha > div + div { border-left: 1px solid #36425c; }
  .heroLinha span { color: #a7b0c2; }
  .heroLinha b { font-size: 11px; font-weight: 650; }
  .heroLinha .hlData { flex: 0 0 auto; flex-direction: column; align-items: flex-start; gap: 0; padding-left: 12px; }
  .hlData b { font-size: 13px; }
  .hlData span::first-letter { text-transform: uppercase; }
  .heroLinha .hlCaixa { flex: 0 0 auto; background: #1d5e45; color: #fff; }
  .hlCaixa span { color: #cbead9; }

  /* ── Caixas do período ── */
  .boxes { display: flex; gap: 6px; padding-bottom: 14px; }
  .box {
    flex: 1; min-width: 0; padding: 8px 11px; border-radius: 5px;
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .box .caixaRot { color: #dfe5f2; }
  .box .caixaVal { font-size: 15px; }
  .bFat { background: #1f6470; } .bDesp { background: #8a2f2c; }
  .bLucro { background: #34508f; } .bCaixa { background: #1d5e45; }

  /* ── Formas de pagamento ── */
  .formas { margin: 14px 0 18px; break-inside: avoid; page-break-inside: avoid; }
  .regua { display: flex; gap: 2px; height: 7px; border-radius: 2px; overflow: hidden; background: #eef1f6; }
  .regua span { display: block; }
  .secTit {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    margin: 12px 0 6px; font-size: 11.5px; font-weight: 600;
  }
  .secTit small { font-size: 10px; font-weight: 400; color: #6b7487; }

  /* ── Filtros aplicados ── */
  .filtros { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0 0 14px; font-size: 10px; color: #6b7487; }
  .filtros b { color: #1c2333; font-weight: 600; }

  /* ── Tabelas ── */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  thead th {
    font-size: 9.5px; font-weight: 500; color: #6b7487; text-align: center;
    padding: 6px 8px; background: #f1f3f8; border-bottom: 1px solid #dde2ec;
  }
  thead th:first-child { border-radius: 4px 0 0 4px; }
  thead th:last-child  { border-radius: 0 4px 4px 0; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #eceff5; text-align: center; vertical-align: middle; }
  tbody tr { page-break-inside: avoid; break-inside: avoid; }
  tbody tr:last-child td { border-bottom: none; }
  .tl { text-align: left; }
  .muted { color: #6b7487; }
  .in { color: #1f7a4d; } .out { color: #b4372f; }
  .val { white-space: nowrap; }

  .forma { display: inline-flex; align-items: center; gap: 7px; }
  .formaDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  /* ── Extrato do dia: linha do tempo ── */
  .dia { margin-bottom: 20px; }
  .ledger .cTl { width: 30px; padding: 0; position: relative; }
  .ledger td.cTl::before {
    content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
    background: #dde2ec; transform: translateX(-.5px);
  }
  .ledger tbody tr:first-child td.cTl::before { top: 50%; }
  .ledger tbody tr:last-child  td.cTl::before { bottom: 50%; }
  .ledger tbody tr:only-child  td.cTl::before { display: none; }
  .dot {
    position: relative; z-index: 1; margin: 0 auto;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1.5px solid var(--m); color: var(--m);
  }
  .dotOut { border-style: dashed; }
  .dot img { width: 11px; height: 11px; object-fit: contain; }
  .cHora { width: 44px; }
  .cForma { width: 96px; }
  .cValor { width: 92px; }
  .cSaldo { width: 92px; }
  .desc { display: block; color: #1c2333; word-break: break-word; }
  .sub { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin-top: 1px; font-size: 9px; color: #6b7487; }
  .flag { color: #a0611a; display: inline-flex; align-items: center; gap: 3px; }
  .flagOut { color: #b4372f; }
  .vazio { color: #6b7487; text-align: center; padding: 14px; font-size: 10px; }

  /* ── Rodapé ── */
  .foot {
    margin-top: 16px; padding-top: 7px; border-top: 1px solid #dde2ec;
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 8.5px; color: #8a92a3;
  }
`;

// ── Blocos ───────────────────────────────────────────────────────────────────

const tot = (rot, icone, valor, cls) =>
  `<div>${icone}<span>${escapeHtml(rot)}</span><b class="${cls ?? ''}">${valor}</b></div>`;

// Cabeçalho do dia numa linha só: data, entrou, saiu, resultado e saldo do caixa.
function heroDia(g, perm) {
  const entrada = g.total_entrada_dia ?? 0;
  const saida   = Math.abs(g.total_saida_dia ?? 0);
  const lucro   = g.lucro_total_dia ?? 0;
  const saldo   = perm.caixa ? saldoFechamento(g) : null;
  const [d, m, y] = (g.data ?? '').split('/');
  const dataCurta = y ? `${d}/${m}/${y.slice(-2)}` : (g.data ?? '—');
  return `
    <div class="heroLinha">
      <div class="hlData"><b>${escapeHtml(dataCurta)}</b><span>${escapeHtml(diaSemana(g.data))}</span></div>
      ${perm.totaisDia ? `
        ${tot(tr('Entrou'), `<span class="hIn">${ico('arrowUpRight', 12)}</span>`, brl(entrada), 'hIn')}
        ${tot(tr('Saiu'), `<span class="hOut">${ico('arrowDownRight', 12)}</span>`, brl(saida), 'hOut')}
        ${tot(tr('Resultado'), lucro < 0 ? `<span class="hOut">${ico('trendingDown', 12)}</span>` : `<span class="hIn">${ico('trendingUp', 12)}</span>`, brl(lucro), lucro < 0 ? 'hOut' : '')}` : ''}
      ${saldo != null ? `
        <div class="hlCaixa">${ico('banknote', 12)}<span>${tr('Saldo do caixa')}</span><b class="${saldo < 0 ? 'hOut' : ''}">${brl(saldo)}</b></div>` : ''}
    </div>`;
}

function heroPeriodo({ periodo, total, saldo, perm }) {
  const lucro = total.lucro ?? 0;
  const box = (cls, rot, icone, valor, neg = false) => `
    <div class="box ${cls}">
      <span class="caixaRot">${icone} ${escapeHtml(rot)}</span>
      <span class="caixaVal${neg ? ' hOut' : ''}">${valor}</span>
    </div>`;
  return `
    <div class="hero">
      <div class="heroTopo">
        <div>
          <div class="heroRot">${tr('Período')}</div>
          <h2 class="heroNome">${escapeHtml(periodo)}</h2>
        </div>
      </div>
      <div class="boxes">
        ${perm.dashboard ? `
          ${box('bFat', tr('Faturamento'), ico('arrowUpRight', 11), brl(total.receitas))}
          ${box('bDesp', tr('Despesas'), ico('arrowDownRight', 11), brl(Math.abs(total.despesas ?? 0)))}
          ${box('bLucro', tr('Lucro'), ico(lucro < 0 ? 'trendingDown' : 'trendingUp', 11), brl(lucro), lucro < 0)}` : ''}
        ${saldo != null ? box('bCaixa', tr('Saldo do caixa'), ico('banknote', 11), brl(saldo), saldo < 0) : ''}
      </div>
    </div>`;
}

function blocoFormas(entries, totalReceitas, legenda) {
  if (!entries.length) return '';
  const segmentos = entries.map(([m, v]) => {
    const pct = totalReceitas > 0 ? (v.receitas / totalReceitas) * 100 : 0;
    return pct > 0 ? `<span style="width:${pct}%;background:${corMetodo(m)}"></span>` : '';
  }).join('');
  const linhas = entries.map(([m, v]) => {
    const pct = totalReceitas > 0 ? (v.receitas / totalReceitas) * 100 : 0;
    return `
      <tr>
        <td class="tl"><span class="forma"><span class="formaDot" style="background:${corMetodo(m)}"></span>${escapeHtml(m)}</span></td>
        <td class="muted">${v.amount ?? 0}</td>
        <td class="val">${brl(v.receitas)}</td>
        <td class="muted">${Math.round(pct)}%</td>
      </tr>`;
  }).join('');
  return `
    <section class="formas">
      <div class="regua">${segmentos}</div>
      <div class="secTit"><span>${tr('Faturamento por forma de pagamento')}</span>${legenda ? `<small>${escapeHtml(legenda)}</small>` : ''}</div>
      <table>
        <thead><tr>
          <th class="tl">${tr('Forma')}</th><th>${tr('Lançamentos')}</th><th>${tr('Faturamento')}</th><th>${tr('Participação')}</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </section>`;
}

function blocoFiltros(filtros) {
  if (!filtros.length) return '';
  return `<div class="filtros">${filtros.map(f =>
    `<span>${escapeHtml(f.label)}: <b>${escapeHtml(f.value)}</b></span>`).join('')}</div>`;
}

function linhaLancamento(t, perm) {
  const { final, temDesconto, isExp } = valorLancamento(t);
  const metodo  = t.pagamento?.tipo_pagamento?.descricao;
  const img     = imgMetodo(metodo);
  const pagador = t.pagamento?.nome_pagador;
  const saldo   = t.valor_historico_dinheiro ?? 0;
  return `
    <tr>
      <td class="cTl">
        <span class="dot${isExp ? ' dotOut' : ''}" style="--m:${corMetodo(metodo)}">
          ${img ? `<img src="${img}" alt="">` : ico('clock', 10)}
        </span>
      </td>
      <td class="cHora muted">${escapeHtml(horaDe(t.data_hora_registro))}</td>
      <td class="tl">
        <span class="desc">${escapeHtml(t.relatorio ?? '—')}</span>
        <span class="sub">
          ${pagador ? `<span>${escapeHtml(pagador)}</span>` : ''}
          ${t.despesa_pessoal ? `<span class="flag flagOut">${tr('Despesa interna')}</span>` : ''}
          ${temDesconto ? `<span class="flag">${ico('tag', 9)} ${tr('Com desconto')}</span>` : ''}
          ${t.editado ? `<span class="flag flagOut">${tr('Editado')}</span>` : ''}
        </span>
      </td>
      <td class="cForma muted">${escapeHtml(metodo ?? '—')}</td>
      <td class="cValor val ${isExp ? 'out' : 'in'}">${isExp ? '−' : '+'}${brl(final)}</td>
      ${perm.saldo ? `<td class="cSaldo val ${saldo < 0 ? 'out' : 'muted'}">${brl(saldo)}</td>` : ''}
    </tr>`;
}

function blocoDia(g, perm) {
  const itens = itensDoGrupo(g);
  const nCols = perm.saldo ? 6 : 5;
  const corpo = itens.length
    ? itens.map(t => linhaLancamento(t, perm)).join('')
    : `<tr><td class="vazio" colspan="${nCols}">${tr('Sem lançamentos.')}</td></tr>`;
  return `
    <section class="dia">
      ${heroDia(g, perm)}
      <table class="ledger">
        <thead><tr>
          <th class="cTl"></th>
          <th class="cHora">${tr('Hora')}</th>
          <th class="tl">${tr('Lançamento')}</th>
          <th class="cForma">${tr('Forma')}</th>
          <th class="cValor">${tr('Valor')}</th>
          ${perm.saldo ? `<th class="cSaldo">${tr('Saldo do caixa')}</th>` : ''}
        </tr></thead>
        <tbody>${corpo}</tbody>
      </table>
    </section>`;
}

// ── Documento + impressão ────────────────────────────────────────────────────

function documento({ titulo, subtitulo, usuario, corpoHtml }) {
  const agora = new Date();
  return `<!doctype html><html lang="${locale()}"><head><meta charset="utf-8">
    <base href="${escapeHtml(window.location.origin)}/">
    <title>${escapeHtml(titulo)}</title><style>${CSS}</style></head>
    <body>
      <header class="head">
        <div>
          <div class="brand">maishospedagem</div>
          <h1>${escapeHtml(titulo)}</h1>
          ${subtitulo ? `<div class="sub">${escapeHtml(subtitulo)}</div>` : ''}
        </div>
        <div class="emit">
          ${tr('Emitido em')} <b>${escapeHtml(agora.toLocaleString(locale()))}</b>
          ${usuario ? `<br>${tr('Por')} <b>${escapeHtml(usuario)}</b>` : ''}
        </div>
      </header>
      ${corpoHtml}
      <footer class="foot">
        <span>maishospedagem · ${tr('Relatório financeiro')}</span>
        <span>${escapeHtml(agora.toLocaleDateString(locale()))}</span>
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

  // Espera a fonte e os ícones das formas de pagamento; o timer garante a
  // impressão mesmo se o carregamento demorar.
  const imagens = [...doc.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  Promise.all([doc.fonts?.ready, ...imagens].filter(Boolean))
    .then(() => setTimeout(disparar, 60))
    .catch(() => {});
  setTimeout(disparar, 1500);
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

// Relatório de um único dia — extrato do dia como aparece na tela.
export function relatorioDiaPdf(grupo, { permissoes, usuario } = {}) {
  if (!grupo) return;
  const perm  = permissoesPadrao(permissoes);
  const itens = itensDoGrupo(grupo);

  const entries  = pagamentosDoDia(itens);
  const receitas = entries.reduce((soma, [, v]) => soma + v.receitas, 0);
  const formas = perm.dashboard
    ? blocoFormas(entries, receitas, itens.length === 1 ? tr('1 lançamento') : tr('{{n}} lançamentos', { n: itens.length }))
    : '';

  const html = documento({
    titulo: tr('Relatório do dia'),
    subtitulo: grupo.data,
    usuario,
    corpoHtml: blocoDia(grupo, perm) + formas,
  });
  imprimir(html, tr('Relatório {{data}}', { data: grupo.data ?? '' }));
}

// Relatório da busca filtrada — totais do período, formas e todos os dias.
export function relatorioFiltroPdf({
  grupos = [], total, pagamentos = {}, filtros = [], periodo = '', permissoes, usuario,
} = {}) {
  const perm = permissoesPadrao(permissoes);
  const totais  = total ?? { receitas: 0, despesas: 0, lucro: 0 };
  const entries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');

  // aceita tanto a lista de filtros da tela quanto uma string simples
  const listaFiltros = Array.isArray(filtros)
    ? filtros
    : filtros ? [{ label: tr('Filtros'), value: filtros }] : [];

  const periodoFiltro = listaFiltros.find(f => f.type === 'periodo')?.value;
  const saldo = perm.caixa && grupos.length ? saldoFechamento(grupos[0]) : null;
  const cabecalho = (perm.dashboard || saldo != null)
    ? heroPeriodo({ periodo: periodoFiltro ?? tr('Todos os dias listados'), total: totais, saldo, perm })
    : '';
  const formas = perm.dashboard ? blocoFormas(entries, totais.receitas ?? 0, periodo) : '';

  const corpo = grupos.length
    ? grupos.map(g => blocoDia(g, perm)).join('')
    : `<p class="vazio" style="padding:24px">${tr('Nenhum lançamento no período filtrado.')}</p>`;

  const html = documento({
    titulo: tr('Relatório financeiro'),
    subtitulo: '',
    usuario,
    corpoHtml: cabecalho + blocoFiltros(listaFiltros) + formas + corpo,
  });
  imprimir(html, tr('Relatório financeiro'));
}

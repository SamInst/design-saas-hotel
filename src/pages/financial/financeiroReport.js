// ─────────────────────────────────────────────────────────────
//  financeiroReport.js
//  Geração de relatórios PDF do Financeiro via impressão do navegador.
//
//  Estratégia: monta um documento HTML leve (texto vetorial) dentro de
//  um iframe oculto e dispara window.print(). O usuário escolhe
//  "Salvar como PDF". Como não há captura de imagem (html2canvas), o
//  arquivo gerado é pequeno e mantém a estrutura/identidade da tela.
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

// Extrai apenas a hora de "dd/MM/yyyy HH:mm" (a data já aparece no cabeçalho do dia).
function apenasHora(s) {
  if (!s) return '—';
  const parts = String(s).trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : s;
}

// Cor por forma de pagamento (mesma paleta da tela).
const ACCENT_HEX = {
  sky: '#0ea5e9', violet: '#7c3aed', indigo: '#6366f1', emerald: '#10b981',
  fuchsia: '#d946ef', amber: '#f59e0b', slate: '#64748b',
};
function corMetodo(d = '') {
  const u = (d ?? '').toUpperCase();
  if (u.includes('PIX'))                              return ACCENT_HEX.sky;
  if (u.includes('CREDITO') || u.includes('CRÉDITO')) return ACCENT_HEX.violet;
  if (u.includes('DEBITO')  || u.includes('DÉBITO'))  return ACCENT_HEX.indigo;
  if (u.includes('DINHEIRO'))                         return ACCENT_HEX.emerald;
  if (u.includes('NUBANK'))                           return ACCENT_HEX.fuchsia;
  if (u.includes('TRANSFER'))                         return ACCENT_HEX.amber;
  if (u.includes('PENDENTE'))                         return ACCENT_HEX.slate;
  return ACCENT_HEX.violet;
}

// Valor final do lançamento, replicando a regra de desconto da tela.
function valorLancamento(t) {
  const bruto = Math.abs(t.pagamento?.valor ?? t.valor ?? 0);
  const d = t.pagamento?.desconto;
  const final = d
    ? bruto - (d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0))
    : bruto;
  return { final, isExp: (t.valor ?? 0) < 0 };
}

// CSS enxuto — só texto e bordas, nenhuma imagem → PDF leve.
const CSS = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 14mm 12mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font: 11px/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1e1b2e;
  }
  .rep-head {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2px solid #7c3aed; padding-bottom: 8px; margin-bottom: 14px;
  }
  .rep-head h1 { font-size: 17px; margin: 0; color: #7c3aed; }
  .rep-head p  { margin: 3px 0 0; font-size: 11px; color: #555; }
  .gen { font-size: 10px; color: #888; text-align: right; }

  .resumo { display: flex; gap: 8px; margin-bottom: 14px; }
  .kpi {
    flex: 1; border: 1px solid #e6e1f5; border-radius: 8px; padding: 8px 10px;
  }
  .kpi span { display: block; font-size: 10px; color: #666; margin-bottom: 3px; }
  .kpi b { font-size: 14px; }

  .distrib { margin-bottom: 14px; }
  .distrib h4 { font-size: 11px; margin: 0 0 6px; color: #555; }
  .distrib ul { list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 16px; }
  .distrib li { display: flex; justify-content: space-between;
    border-bottom: 1px dotted #ddd; padding: 2px 0; }

  .day { margin-bottom: 14px; page-break-inside: avoid; }
  .dayhead {
    display: flex; justify-content: space-between; align-items: center;
    background: #f6f3fe; border: 1px solid #e6e1f5; border-radius: 6px;
    padding: 6px 10px; margin-bottom: 6px;
  }
  .dayhead h3 { font-size: 12px; margin: 0; }
  .daystats { display: flex; gap: 14px; font-size: 11px; }
  .daystats b { margin-left: 4px; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    font-size: 10px; text-transform: uppercase; letter-spacing: .03em;
    color: #777; text-align: left; padding: 4px 6px; border-bottom: 1px solid #ccc;
  }
  tbody td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .pagador { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .num { text-align: right; white-space: nowrap; }
  .pos { color: #059669; }
  .neg { color: #dc2626; }
  .tag {
    font-size: 8px; background: #efeafc; color: #7c3aed; border-radius: 4px;
    padding: 1px 4px; margin-left: 4px;
  }
  .rep-foot {
    margin-top: 18px; padding-top: 6px; border-top: 1px solid #eee;
    font-size: 9px; color: #aaa; text-align: center;
  }
`;

function linhasLancamentos(relatorios = []) {
  if (!relatorios.length) {
    return '<tr><td colspan="5" style="color:#999;text-align:center;padding:10px">Sem lançamentos.</td></tr>';
  }
  return relatorios
    .map((t) => {
      const { final, isExp } = valorLancamento(t);
      const metodo = t.pagamento?.tipo_pagamento?.descricao ?? '—';
      const interna = t.despesa_pessoal ? '<span class="tag">Interna</span>' : '';
      return `<tr>
        <td>${escapeHtml(apenasHora(t.data_hora_registro))}</td>
        <td>${escapeHtml(t.relatorio ?? '—')}${interna}<div class="pagador">${escapeHtml(t.pagamento?.nome_pagador ?? '—')}</div></td>
        <td>${escapeHtml(t.quarto?.id ?? '—')}</td>
        <td><b style="color:${corMetodo(metodo)}">${escapeHtml(metodo)}</b></td>
        <td class="num ${isExp ? 'neg' : 'pos'}">${isExp ? '−' : '+'}${brl(final)}</td>
      </tr>`;
    })
    .join('');
}

function blocoDia(g) {
  const lucro = g.lucro_total_dia ?? 0;
  return `
    <section class="day">
      <div class="dayhead">
        <h3>${escapeHtml(g.data)}</h3>
        <div class="daystats">
          <span>Receita <b class="pos">${brl(g.total_entrada_dia)}</b></span>
          <span>Despesa <b class="neg">${brl(g.total_saida_dia)}</b></span>
          <span>Lucro <b class="${lucro >= 0 ? 'pos' : 'neg'}">${brl(lucro)}</b></span>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Hora</th><th>Descrição</th><th>Quarto</th><th>Forma</th><th class="num">Valor</th>
        </tr></thead>
        <tbody>${linhasLancamentos(g.relatorios)}</tbody>
      </table>
    </section>`;
}

function documento({ titulo, subtitulo, resumoHtml = '', corpoHtml }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${escapeHtml(titulo)}</title><style>${CSS}</style></head>
    <body>
      <header class="rep-head">
        <div>
          <h1>${escapeHtml(titulo)}</h1>
          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ''}
        </div>
        <div class="gen">Emitido em<br>${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
      </header>
      ${resumoHtml}
      ${corpoHtml}
      <footer class="rep-foot">Isto é Pousada · Relatório financeiro</footer>
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

  // dá tempo para o layout do iframe estabilizar antes de imprimir
  setTimeout(() => {
    win.focus();
    win.print();
    // fallback: remove o iframe mesmo se onafterprint não disparar
    setTimeout(limpar, 60000);
  }, 250);
}

// Relatório de um único dia (todos os lançamentos do dia + estatísticas).
export function relatorioDiaPdf(grupo) {
  if (!grupo) return;
  const html = documento({
    titulo: 'Relatório Diário',
    subtitulo: grupo.data,
    corpoHtml: blocoDia(grupo),
  });
  imprimir(html, `Relatório ${grupo.data ?? ''}`);
}

// Relatório da busca filtrada (totais + distribuição + todos os dias).
export function relatorioFiltroPdf({ grupos = [], total, pagamentos = {}, filtros = '' }) {
  const tot = total ?? { receitas: 0, despesas: 0, lucro: 0 };
  const entries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');
  const cash = entries.find(([m]) => m.toUpperCase().includes('DINHEIRO'));
  const cv = cash?.[1] ?? { lucro: 0 };

  const resumoHtml = `
    <section class="resumo">
      <div class="kpi"><span>Receita total</span><b class="pos">${brl(tot.receitas)}</b></div>
      <div class="kpi"><span>Despesa total</span><b class="neg">${brl(Math.abs(tot.despesas))}</b></div>
      <div class="kpi"><span>Lucro</span><b class="${(tot.lucro ?? 0) >= 0 ? 'pos' : 'neg'}">${brl(tot.lucro)}</b></div>
      <div class="kpi"><span>Saldo do caixa</span><b>${brl(cv.lucro)}</b></div>
    </section>
    ${
      entries.length
        ? `<section class="distrib"><h4>Receita por forma de pagamento</h4><ul>${entries
            .map(([m, v]) => `<li><span>${escapeHtml(m)}</span><b>${brl(v.receitas)}</b></li>`)
            .join('')}</ul></section>`
        : ''
    }`;

  const corpoHtml = grupos.length
    ? grupos.map(blocoDia).join('')
    : '<p style="color:#999;text-align:center;padding:20px">Nenhum lançamento no período filtrado.</p>';

  const html = documento({
    titulo: 'Relatório Financeiro',
    subtitulo: filtros || 'Busca filtrada',
    resumoHtml,
    corpoHtml,
  });
  imprimir(html, 'Relatório Financeiro');
}

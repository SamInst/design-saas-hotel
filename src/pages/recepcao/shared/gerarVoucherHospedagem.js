const initials = (nome) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const fmtCpf = (v) => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : (v || '');
};

export const gerarVoucherHospedagem = ({ quarto, servico, incluirConsumo = false, userName = '' }) => {
  const sv  = servico;
  const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fn  = (n) => `${n} noite${n !== 1 ? 's' : ''}`;

  const diarias    = sv.diarias || [];
  const consumos   = sv.consumos || [];
  const pagamentos = diarias.flatMap((d) => d.pagamentos || []);

  // Collect unique hospedes across all diárias
  const hospedeSeen = new Set();
  const hospedes = diarias.flatMap((d) => d.hospedes || []).filter((h) => {
    const key = h.id ?? h.nome;
    if (hospedeSeen.has(key)) return false;
    hospedeSeen.add(key);
    return true;
  });

  const titular = hospedes[0];
  const acomps  = hospedes.slice(1);

  const totalHosp    = sv.valorTotal ?? 0;
  const totalConsumo = incluirConsumo ? consumos.reduce((s, c) => s + (c.valorTotal ?? c.valor ?? 0), 0) : 0;
  const grandTotal   = totalHosp + totalConsumo;
  const totalPago    = pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0);
  const pendente     = grandTotal - totalPago;

  const nowFmt = (() => {
    const n = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(n.getDate())}-${pad(n.getMonth()+1)}-${n.getFullYear()} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  })();

  const titularNome = (sv.titularNome || titular?.nome || '').toUpperCase();
  const docTitle    = `${nowFmt} VOUCHER DE HOSPEDAGEM${titularNome ? ` | ${titularNome}` : ''}`;

  // ── Hóspedes ────────────────────────────────────────────────────────────────
  const hospedesHtml = hospedes.length === 0 ? '' : `
    <div class="quarto-section">
      ${titular ? `
        <div class="person-row">
          <div class="person-avatar">${initials(titular.nome)}</div>
          <div>
            <div class="person-name">${titular.nome} <span class="titular-tag">Titular</span></div>
            ${titular.cpf ? `<div class="person-cpf">${fmtCpf(titular.cpf)}</div>` : ''}
          </div>
        </div>` : ''}
      ${acomps.map((h) => `
        <div class="person-row">
          <div class="person-avatar">${initials(h.nome)}</div>
          <div>
            <div class="person-name">${h.nome}</div>
            ${h.cpf ? `<div class="person-cpf">${fmtCpf(h.cpf)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;

  // ── Diárias (price-row pattern) ───────────────────────────────────────────
  const diariasHtml = diarias.map((d, i) => {
    const label = `Diária ${d.num ?? (i + 1)}${d.dataInicio ? ` &nbsp; ${d.dataInicio} → ${d.dataFim}` : ''}`;
    return `
      <div class="price-row">
        <span class="price-desc">${label}</span>
        <span class="price-val">${brl(d.valor)}</span>
      </div>`;
  }).join('');

  // ── Consumo (price-row pattern) ───────────────────────────────────────────
  const consumoBlockHtml = (!incluirConsumo || consumos.length === 0) ? '' : `
    <div class="consumo-sep"></div>
    <div class="consumo-header">Consumo</div>
    ${consumos.map((c) => `
      <div class="price-row">
        <span class="price-desc">${c.item || c.descricao || '—'}${c.quantidade ? ` <span class="price-qty">×${c.quantidade}</span>` : ''}</span>
        <span class="price-val">${brl(c.valorTotal ?? c.valor)}</span>
      </div>`).join('')}`;

  // ── Room block ────────────────────────────────────────────────────────────
  const roomBlockHtml = `
    <div class="room-block">
      <div class="room-card">
        <div class="room-label">Apartamento ${quarto.numero}
          ${quarto.categoria ? `<span class="room-desc">${quarto.categoria}${quarto.tipoOcupacao ? ` · ${quarto.tipoOcupacao}` : ''}</span>` : ''}
        </div>
      </div>
      ${hospedesHtml}
      ${diariasHtml}
      ${consumoBlockHtml}
      <div class="total-row">
        <span class="total-label">Total${incluirConsumo && consumos.length > 0 ? ' (Hospedagem + Consumo)' : ''}</span>
        <span class="total-val">${brl(grandTotal)}</span>
      </div>
    </div>`;

  // ── Pagamentos ────────────────────────────────────────────────────────────
  const pagsHtml = pagamentos.length === 0 ? '' : `
    <div class="pags-section" style="margin-top:20px">
      <div class="pags-title">Pagamentos</div>
      ${pagamentos.map((p) => {
        const dtPag = (() => {
          if (!p.data && !p.dataRegistro) return '';
          const raw = (p.data || p.dataRegistro || '').split(' ');
          return raw[0] ? `${raw[0]}${raw[1] ? ' ' + raw[1].slice(0, 5) : ''}` : '';
        })();
        return `<div class="pag-row">
          <div class="pag-left">
            ${p.descricao       ? `<span class="pag-forma">${p.descricao}</span>`                                   : ''}
            ${p.nomePagador     ? `<span class="pag-nome">${p.nomePagador}</span>`                                  : ''}
            ${dtPag || p.formaPagamento ? `<span class="pag-data">${[dtPag, p.formaPagamento].filter(Boolean).join(' · ')}</span>` : ''}
            ${p.funcionario     ? `<span class="pag-func">registrado por ${p.funcionario}</span>`                   : ''}
          </div>
          <span class="pag-val">${brl(p.valor)}</span>
        </div>`;
      }).join('')}
    </div>`;

  // ── Financial strip ───────────────────────────────────────────────────────
  const stripStyle = pagamentos.length === 0 ? 'style="margin-top:20px;border-radius:0 0 8px 8px;border-top:1px solid #e2e8f0"' : '';
  const stripHtml  = `
    <div class="price-strip" ${stripStyle}>
      <div class="price-strip-item">Pendente &nbsp;<b class="pendente-val">${brl(pendente)}</b></div>
      <div class="price-strip-divider"></div>
      <div class="price-strip-item">Pago &nbsp;<b class="pago-val">${brl(totalPago)}</b></div>
      <div class="price-strip-divider"></div>
      <div class="price-strip-item">Valor Total &nbsp;<b>${brl(grandTotal)}</b></div>
    </div>`;

  // ── Date band ─────────────────────────────────────────────────────────────
  const checkinDate  = (sv.chegadaPrevista  || '').split(' ')[0] || '—';
  const checkoutDate = (sv.saidaPrevista    || '').split(' ')[0] || '—';
  const bandHtml = `<div class="periodo-band">${checkinDate} → ${checkoutDate} · ${fn(sv.totalDiarias ?? 0)}</div>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#0f172a;font-size:14px}
    .page{max-width:740px;margin:0 auto;padding:32px 28px}
    .doc-title{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .doc-sub{font-size:12px;color:#94a3b8;margin-bottom:24px}
    .doc-header{margin-bottom:24px;padding-bottom:18px;border-bottom:2px solid #1e293b}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px}
    .info-item label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:2px;display:block}
    .info-item span{font-size:13px;color:#0f172a;font-weight:500}
    .periodo-band{background:#1e293b;color:#fff;padding:11px 20px;border-radius:8px 8px 0 0;font-size:14px;font-weight:600;letter-spacing:.01em;margin-top:20px}
    .price-strip{display:flex;align-items:center;justify-content:center;padding:14px 16px;border:1px solid #e2e8f0;border-top:none;background:#f8fafc;margin-top:0;border-radius:0 0 8px 8px}
    .price-strip-item{display:flex;align-items:center;gap:6px;font-size:15px;color:#64748b;flex:1;justify-content:center}
    .price-strip-item b{color:#0f172a;font-weight:700}
    .price-strip-divider{width:1px;height:18px;background:#e2e8f0;margin:0 12px}
    .pago-val{color:#10b981 !important}
    .pendente-val{color:#f97316 !important}
    .room-block{border:1px solid #e2e8f0;border-top:none;padding:14px 16px;display:flex;flex-direction:column;gap:12px;border-radius:0 0 8px 8px}
    .room-card{display:flex;flex-direction:column;gap:4px}
    .room-label{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .room-desc{font-weight:400;color:#64748b;font-size:12px;margin-left:6px}
    .price-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .price-desc{font-size:12px;color:#475569}
    .price-val{font-size:12px;font-weight:500;color:#475569;white-space:nowrap}
    .price-qty{color:#94a3b8;font-size:11px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:6px;border-top:1px solid #e2e8f0}
    .total-label{font-size:13px;font-weight:700;color:#0f172a}
    .total-val{font-size:14px;font-weight:800;color:#0f172a}
    .quarto-section{margin-top:2px}
    .person-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .person-avatar{width:38px;height:38px;border-radius:50%;background:#ede9fe;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
    .person-name{font-size:13px;font-weight:600;color:#0f172a}
    .person-cpf{font-size:11px;color:#64748b;margin-top:1px}
    .titular-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:#ede9fe;color:#7c3aed;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle}
    .consumo-sep{height:1px;background:#e2e8f0;margin:4px 0}
    .consumo-header{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:6px}
    .pags-section{margin-top:20px;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;overflow:hidden}
    .pags-title{background:#1e293b;color:#fff;padding:11px 20px;font-size:14px;font-weight:600;letter-spacing:.01em}
    .pag-row{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f1f5f9;gap:12px}
    .pag-row:last-child{border-bottom:none}
    .pag-left{display:flex;flex-direction:column;gap:2px}
    .pag-forma{font-size:13px;font-weight:600;color:#0f172a}
    .pag-nome{font-size:12px;color:#475569}
    .pag-data{font-size:11px;color:#94a3b8}
    .pag-func{font-size:11px;color:#94a3b8}
    .pag-val{font-size:14px;font-weight:700;color:#10b981;white-space:nowrap}
    @media print{
      @page{margin:10mm 10mm 10mm 10mm}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{padding:20px}
    }
  </style>
</head><body>
<div class="page">
  <div class="doc-header">
    <div class="doc-title">Isto é Pousada &nbsp;|&nbsp; Voucher de Hospedagem${incluirConsumo ? ' + Consumo' : ''}</div>
    <div class="doc-sub">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}${userName ? ` por ${userName}` : ''}</div>
    <div class="info-grid">
      <div class="info-item"><label>Apartamento</label><span>${quarto.numero}</span></div>
      <div class="info-item"><label>Categoria</label><span>${quarto.categoria || '—'}${quarto.tipoOcupacao ? ` · ${quarto.tipoOcupacao}` : ''}</span></div>
      <div class="info-item"><label>Titular</label><span>${titularNome || '—'}</span></div>
      <div class="info-item"><label>Total de Noites</label><span>${sv.totalDiarias ?? '—'}</span></div>
    </div>
  </div>
  ${bandHtml}
  ${roomBlockHtml}
  ${pagsHtml}
  ${stripHtml}
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => win.close();
};

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

export const gerarVoucherReserva = ({ tipo, periodoMode, displayPeriodos, precosCalc, quartosObs, roomDescMap, userName = '', solicitante = null, pagamentos = [] }) => {
  const brl  = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dt   = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  const dias = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const fn   = (n) => `${n} diária${n !== 1 ? 's' : ''}`;
  const rm   = (n) => String(n).padStart(2, '0');
  const addD = (s, n) => {
    const d2 = new Date(s + 'T00:00:00');
    d2.setDate(d2.getDate() + n);
    const yy = d2.getFullYear();
    const mm = String(d2.getMonth() + 1).padStart(2, '0');
    const dd = String(d2.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const grandTotal = displayPeriodos
    .flatMap((p, pi) => p.rooms.map((q) => precosCalc[`${q}_${pi}`]?.valor_total ?? 0))
    .reduce((a, b) => a + b, 0);

  let periodsHtml = '';
  let unicoRoomsHtml = '';

  displayPeriodos.forEach((p, pi) => {
    const d = dias(p.checkin, p.checkout);
    const periodLabel = periodoMode === 'multiplos'
      ? `<div class="periodo-band">Período ${pi + 1} &nbsp;·&nbsp; ${dt(p.checkin)} → ${dt(p.checkout)} · ${fn(d)}</div>`
      : '';
    let roomsHtml = '';

    p.rooms.forEach((quartoId) => {
      const calc = precosCalc[`${quartoId}_${pi}`] ?? { valor_total: 0, detalhes: [], sazonalidades_aplicadas: [] };
      const hospedes = p.roomHospedes?.[quartoId] || [];
      const obs      = quartosObs[`${quartoId}_${pi}`] ?? quartosObs[quartoId] ?? '';
      const desc     = roomDescMap[quartoId] || '';

      let detalhesHtml = '';
      if ((calc.detalhes || []).length > 0) {
        calc.detalhes.forEach((det) => {
          const hasSub = det.valor_base > 0 || det.acrescimo_sazonalidade > 0 || det.valor_criancas > 0;
          detalhesHtml += `
            <div class="price-row">
              <span class="price-desc">${det.descricao}</span>
              <span class="price-val">${brl(det.valor_final)}</span>
            </div>
            ${hasSub ? `<div class="price-sub">${brl((det.valor_base ?? 0) + (det.acrescimo_sazonalidade ?? 0))}${det.sazonalidade?.descricao ? ` <span class="saz-chip">${det.sazonalidade.descricao}</span>` : ''}${det.valor_criancas > 0 ? ` <span>+ Crianças ${brl(det.valor_criancas)}</span>` : ''}</div>` : ''}`;
        });
      } else if (d > 0 && calc.valor_total > 0) {
        const valorDiaria = calc.valor_total / d;
        for (let di = 0; di < d; di++) {
          detalhesHtml += `
            <div class="price-row">
              <span class="price-desc">Diária ${di + 1} &nbsp; ${dt(addD(p.checkin, di))} → ${dt(addD(p.checkin, di + 1))}</span>
              <span class="price-val">${brl(valorDiaria)}</span>
            </div>`;
        }
      }

      const sazHtml = (calc.sazonalidades_aplicadas || []).length > 0
        ? `<div class="saz-chips">${calc.sazonalidades_aplicadas.map((s) => `<span class="saz-chip">${s.descricao}</span>`).join('')}</div>`
        : '';

      const hospedesHtml = hospedes.map((h) => `
        <div class="person-row">
          <div class="person-avatar">${initials(h.nome)}</div>
          <div>
            <div class="person-name">${h.nome}</div>
            ${h.cpf ? `<div class="person-cpf">${fmtCpf(h.cpf)}</div>` : ''}
          </div>
        </div>`).join('');

      const obsHtml = obs.trim()
        ? `<label class="obs-label">Observação</label><div class="obs-box">${obs.trim()}</div>`
        : '';

      roomsHtml += `
        <div class="room-block">
          <div class="room-card">
            <div class="room-label">Apartamento ${desc || rm(quartoId)}</div>
          </div>
          ${hospedes.length > 0 ? `<div class="quarto-section">${hospedesHtml}</div>` : ''}
          ${obsHtml}
          ${detalhesHtml}
          ${sazHtml}
          <div class="total-row">
            <span class="total-label">Total</span>
            <span class="total-val">${brl(calc.valor_total)}</span>
          </div>
        </div>`;
    });

    if (periodoMode === 'unico') {
      unicoRoomsHtml += roomsHtml;
    } else {
      periodsHtml += `${periodLabel}<div class="period-rooms">${roomsHtml}</div>`;
    }
  });

  const unico    = periodoMode === 'unico' && displayPeriodos[0];
  const unicoD   = unico ? dias(unico.checkin, unico.checkout) : 0;
  const unicoBand = unico ? `<div class="periodo-band">${dt(unico.checkin)} → ${dt(unico.checkout)} · ${fn(unicoD)}</div>` : '';

  const totalRooms = [...new Set(displayPeriodos.flatMap((p) => p.rooms))].length;
  const tipoLabel = totalRooms > 1 ? 'Vários Apartamentos' : 'Apartamento Único';
  const modoLabel = periodoMode === 'unico' ? 'Período único' : 'Múltiplos períodos';

  const titularNome = (solicitante?.nome || (() => {
    for (const p of displayPeriodos) {
      for (const qId of p.rooms) {
        const h = (p.roomHospedes?.[qId] || [])[0];
        if (h?.nome) return h.nome;
      }
    }
    return '';
  })()).toUpperCase();
  const nowFmt = (() => {
    const n = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(n.getDate())}-${pad(n.getMonth()+1)}-${n.getFullYear()} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  })();
  const docTitle = `${nowFmt} VOUCHER DE RESERVA${titularNome ? ` | ${titularNome}` : ''}`;

  const totalPago = pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0);
  const pendente  = grandTotal - totalPago;

  const pagsHtml = pagamentos.length > 0 ? `
    <div class="pags-section" style="margin-top:20px">
      <div class="pags-title">Pagamentos</div>
      ${pagamentos.map((p) => {
        const dtPag = (() => {
          if (!p.dataRegistro) return '';
          const raw = p.dataRegistro.split(' ');
          const parts = (raw[0] || '').split('/');
          if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}${raw[1] ? ' ' + raw[1].slice(0,5) : ''}`;
          return p.dataRegistro;
        })();
        return `<div class="pag-row">
          <div class="pag-left">
            ${p.descricao ? `<span class="pag-forma">${p.descricao}</span>` : ''}
            ${p.nomePagador ? `<span class="pag-nome">${p.nomePagador}</span>` : ''}
            ${dtPag || p.formaPagamento ? `<span class="pag-data">${[dtPag, p.formaPagamento].filter(Boolean).join(' · ')}</span>` : ''}
            ${p.funcionario ? `<span class="pag-func">registrado por ${p.funcionario}</span>` : ''}
          </div>
          <span class="pag-val">${brl(p.valor)}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const summaryHtml = `
    ${pagsHtml}
    <div class="price-strip" ${pagamentos.length === 0 ? 'style="margin-top:20px;border-radius:0 0 8px 8px;border-top:1px solid #e2e8f0"' : ''}>
      <div class="price-strip-item">Pendente &nbsp;<b class="pendente-val">${brl(pendente)}</b></div>
      <div class="price-strip-divider"></div>
      <div class="price-strip-item">Pago &nbsp;<b class="pago-val">${brl(totalPago)}</b></div>
      <div class="price-strip-divider"></div>
      <div class="price-strip-item">Valor Total &nbsp;<b>${brl(grandTotal)}</b></div>
    </div>`;


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
    .room-block{border:1px solid #e2e8f0;border-top:none;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
    .room-block:last-child{border-radius:0 0 8px 8px}
    .room-card{display:flex;flex-direction:column;gap:4px}
    .room-label{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .room-desc{font-weight:400;color:#64748b;font-size:12px;margin-left:6px}
    .price-row{display:flex;justify-content:space-between;align-items:flex-start}
    .price-desc{font-size:12px;color:#475569}
    .price-val{font-size:12px;font-weight:500;color:#475569;white-space:nowrap}
    .price-sub{font-size:11px;color:#94a3b8;margin-bottom:2px}
    .saz-chips{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}
    .saz-chip{font-size:10px;font-weight:700;color:#7c3aed;background:rgba(124,58,237,.1);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.05em}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:6px;border-top:1px solid #e2e8f0}
    .total-label{font-size:13px;font-weight:700;color:#0f172a}
    .total-val{font-size:14px;font-weight:800;color:#0f172a}
    .quarto-section{margin-top:2px}
    .person-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .person-avatar{width:38px;height:38px;border-radius:50%;background:#ede9fe;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
    .person-name{font-size:13px;font-weight:600;color:#0f172a}
    .person-cpf{font-size:11px;color:#64748b;margin-top:1px}
    .obs-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:5px;display:block}
    .obs-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;font-size:13px;color:#64748b;min-height:50px}
    .period-rooms{}
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
    <div class="doc-title">Isto é Pousada &nbsp;|&nbsp; Voucher de Reserva</div>
    <div class="doc-sub">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}${userName ? ` por ${userName}` : ''}</div>
    <div class="info-grid">
      <div class="info-item"><label>Tipo</label><span>${tipoLabel}</span></div>
      <div class="info-item"><label>Modo</label><span>${modoLabel}</span></div>
    </div>
  </div>
  ${periodoMode === 'unico' ? unicoBand : ''}
  ${periodoMode === 'unico' ? unicoRoomsHtml : periodsHtml}
  ${summaryHtml}
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => win.close();
};

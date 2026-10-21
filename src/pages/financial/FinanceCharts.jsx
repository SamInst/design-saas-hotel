import { useState } from 'react';
import styles from './FinancialDashboard.module.css';
import { tr } from '../../i18n';

const fmt = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Rótulos de dado curtos (R$ 12,3 mil) para não poluir o gráfico.
const fmtCurto = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  });

// ── Barras agrupadas: faturamento, despesas e lucro por forma ─
// Eixo único com zero marcado, para lucro negativo crescer para a esquerda.
const SERIES = [
  { k: 'fat',   rot: 'Faturamento', cls: 'serFat' },
  { k: 'desp',  rot: 'Despesas',    cls: 'serDesp' },
  { k: 'lucro', rot: 'Lucro',       cls: 'serLucro' },
];

const passoBonito = (bruto) => {
  if (bruto <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export function ComparativoBarras({ entries, total = 0 }) {
  const [oculto, setOculto] = useState({});
  const [foco, setFoco] = useState(null);
  const linhas = entries
    .map(([m, v]) => ({
      m,
      fat:   v.receitas ?? 0,
      desp:  Math.abs(v.despesas ?? 0),
      lucro: v.lucro ?? ((v.receitas ?? 0) + (v.despesas ?? 0)),
    }))
    .sort((a, b) => b.fat - a.fat);
  const series = SERIES.filter(s => !oculto[s.k]);

  const vals = linhas.flatMap(l => series.map(s => l[s.k]));
  const passo = passoBonito(Math.max(1, ...vals.map(Math.abs)) / 5);
  const max = Math.max(passo, Math.ceil(Math.max(0, ...vals) / passo) * passo);
  const min = Math.min(0, Math.floor(Math.min(0, ...vals) / passo) * passo);
  const faixa = max - min || 1;
  const y = (v) => ((v - min) / faixa) * 100;
  const zero = y(0);
  const ticks = [];
  for (let t = min; t <= max + passo / 2; t += passo) ticks.push(t);

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartTit}>
        <span>{tr('Resultado por forma de pagamento')}</span>
        <span className={styles.serLeg}>
          {SERIES.map(s => (
            <button key={s.k} type="button"
              className={[styles.serBtn, oculto[s.k] ? styles.serBtnOff : ''].join(' ')}
              aria-pressed={!oculto[s.k]}
              onClick={() => setOculto(o => ({ ...o, [s.k]: !o[s.k] }))}>
              <span className={[styles.serCor, styles[s.cls]].join(' ')} />{tr(s.rot)}
            </button>
          ))}
        </span>
      </figcaption>
      {linhas.length === 0 ? (
        <p className={styles.chartVazio}>{tr('Sem lançamentos no período.')}</p>
      ) : (
        <div className={styles.colunas}>
          <div className={styles.colEixo} aria-hidden="true">
            {ticks.map(t => (
              <span key={t} style={{ bottom: `${y(t)}%` }}>{fmtCurto(t)}</span>
            ))}
          </div>
          <div className={styles.colPlot}>
            {ticks.map(t => (
              <span key={t} className={[styles.colGrade, t === 0 ? styles.colZero : ''].join(' ')}
                style={{ bottom: `${y(t)}%` }} />
            ))}
            {linhas.map(l => (
              <div key={l.m}
                className={[styles.colGrupo, foco && foco !== l.m ? styles.colApagado : ''].join(' ')}
                onMouseEnter={() => setFoco(l.m)} onMouseLeave={() => setFoco(null)}>
                {total > 0 && (
                  <b className={styles.colPct}>
                    {Math.round((l.fat / total) * 100)}%
                  </b>
                )}
                <div className={styles.colBarras}>
                  {series.map(s => {
                    const v = l[s.k];
                    const ini = Math.min(y(v), zero), fim = Math.max(y(v), zero);
                    return (
                      <span key={s.k} className={styles.colSlot}>
                        <span
                          className={[styles.col, styles[s.cls], v < 0 ? styles.colNeg : ''].join(' ')}
                          style={{ bottom: `${ini}%`, height: `${Math.max(fim - ini, v ? 0.8 : 0)}%` }}
                          title={`${l.m} · ${tr(s.rot)}: ${fmt(v)}`} />
                      </span>
                    );
                  })}
                </div>
                <span className={styles.colRot}>
                  {l.m}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

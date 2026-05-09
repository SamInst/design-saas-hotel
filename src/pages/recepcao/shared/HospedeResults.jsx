import styles from '../recepcao.module.css';

export default function HospedeResults({ results, onAdd }) {
  if (results.length === 0) return null;
  return (
    <div className={styles.hospedeResults}>
      {results.map((h) => (
        <div key={h.id} className={styles.hospedeResult} onClick={() => onAdd(h)}>
          <span className={styles.hospedeResultName}>{h.nome}</span>
          <span className={styles.hospedeResultSub}>{h.cpf} · {h.telefone}</span>
        </div>
      ))}
    </div>
  );
}

import { Loader2, Square } from 'lucide-react';
import { Modal }  from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { fmtBRL, fmtClock, nowTime } from '../../shared/helpers';
import styles from '../../recepcao.module.css';

export default function EncerrarModal({
  open, onClose, selectedRoom,
  handleEncerrar, saving,
  selElapsedSec, selElapsedMin, selValorAtual,
}) {
  if (!open || !selectedRoom) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={<><Square size={15} /> Encerrar Day Use — Apt. {selectedRoom.numero}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleEncerrar} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            Confirmar Encerramento
          </Button>
        </div>
      }
    >
      <div className={styles.encerrarSummary}>
        <div className={styles.encerrarRow}>
          <span className={styles.encerrarLabel}>Hora de saída</span>
          <span className={styles.encerrarVal}>{nowTime()}</span>
        </div>
        <div className={styles.encerrarRow}>
          <span className={styles.encerrarLabel}>Tempo decorrido</span>
          <span className={styles.encerrarVal}>{fmtClock(selElapsedSec)}</span>
        </div>
        <div className={styles.encerrarRow}>
          <span className={styles.encerrarLabel}>Valor base ({selectedRoom.servico.horasBase}h)</span>
          <span className={styles.encerrarVal}>{fmtBRL(selectedRoom.servico.precoBase)}</span>
        </div>
        {selElapsedMin > selectedRoom.servico.horasBase * 60 && (
          <div className={styles.encerrarRow}>
            <span className={styles.encerrarLabel}>Horas adicionais</span>
            <span className={styles.encerrarVal}>{fmtBRL(selValorAtual - selectedRoom.servico.precoBase)}</span>
          </div>
        )}
        <div className={styles.encerrarRow}>
          <span className={styles.encerrarLabel}>Total a cobrar</span>
          <span className={styles.encerrarValGreen}>{fmtBRL(selValorAtual)}</span>
        </div>
      </div>
    </Modal>
  );
}

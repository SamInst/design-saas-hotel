import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Modal }       from '../../../../components/ui/Modal';
import { Button }      from '../../../../components/ui/Button';
import { FormField }   from '../../../../components/ui/Input';
import DiariasCombobox from '../../shared/DiariasCombobox';
import QuartoCombobox  from '../../shared/QuartoCombobox';
import styles from '../../recepcao.module.css';

export default function TrocaQuartoModal({
  open, onClose, selectedRoom, quartos, apiCategories,
  tqDiariasIdxs, setTqDiariasIdxs,
  tqNovoQuartoId, setTqNovoQuartoId,
  savingTq, handleTrocarQuarto,
}) {
  if (!open || !selectedRoom?.servico) return null;

  const sv           = selectedRoom.servico;
  const diarias      = sv.diarias || [];
  const atualNum     = sv.diariaAtual || 1;
  const futureDiarias = diarias.filter((d) => d.num >= atualNum);
  const novoQuarto   = quartos.find((q) => q.id === tqNovoQuartoId);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={<><ArrowLeftRight size={15} /> Trocar Quarto — Apt. {selectedRoom.numero}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleTrocarQuarto} disabled={savingTq || !tqNovoQuartoId || tqDiariasIdxs.length === 0}>
            {savingTq && <Loader2 size={14} className={styles.spin} />}
            Confirmar Troca
          </Button>
        </div>
      }
    >
      <div className={styles.formStack}>
        <FormField label="Diárias afetadas">
          <DiariasCombobox
            value={tqDiariasIdxs}
            onChange={setTqDiariasIdxs}
            diarias={futureDiarias}
            atualNum={atualNum}
          />
        </FormField>
        <FormField label="Novo apartamento">
          <QuartoCombobox
            value={tqNovoQuartoId}
            onChange={setTqNovoQuartoId}
            quartos={quartos}
            categorias={apiCategories.map((c) => ({ nome: c.nome, quartos: quartos.filter((q) => q.categoriaId === c.id).map((q) => q.numero) }))}
            currentNumero={selectedRoom.numero}
          />
        </FormField>
        {novoQuarto && (
          <div className={styles.pricingHint} style={{ marginTop: 12 }}>
            <span className={styles.pricingHintLabel}>Selecionado:</span>
            <span>Apt. {novoQuarto.numero} — {novoQuarto.categoria} · {novoQuarto.tipoOcupacao}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

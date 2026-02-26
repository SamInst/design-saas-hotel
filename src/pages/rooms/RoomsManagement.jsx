import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble, Users, Wrench, Sparkles, Plus, Edit2, Trash2,
  ChevronDown, Loader2, Search, User, Clock, Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { quartoApi, ROOM_CATEGORIES, STATUS, TIPOS_OCUPACAO } from './roomsMocks';
import styles from './RoomsManagement.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_KEY = {
  [STATUS.DISPONIVEL]:      'disponivel',
  [STATUS.OCUPADO]:         'ocupado',
  [STATUS.RESERVADO]:       'reservado',
  [STATUS.LIMPEZA]:         'limpeza',
  [STATUS.MANUTENCAO]:      'manutencao',
  [STATUS.FORA_DE_SERVICO]: 'fora',
};

const BEDS_LABELS    = { casal: 'Casal', solteiro: 'Solteiro', beliche: 'Beliche', rede: 'Rede' };
const BEDS_LABELS_SH = { casal: 'Casal', solteiro: 'Solt.', beliche: 'Beliche', rede: 'Rede' };

const fmtTime = (dt) => (dt ? String(dt).split(' ')[1] || dt : '—');
const fmtDate = (dt) => {
  if (!dt) return '—';
  const parts = String(dt).split(' ');
  if (parts.length >= 2) {
    const [year, month, day] = parts[0].split('-');
    return `${day}/${month} ${parts[1]}`;
  }
  return dt;
};

const blankForm    = () => ({ numero: '', categoriaId: 1, tipoOcupacao: 'Casal', descricao: '', camas: { casal: 0, solteiro: 0, beliche: 0, rede: 0 } });
const blankService = () => ({ responsavel: '', descricao: '', previsaoFim: '' });

const canChangeStatus = (room) =>
  room && room.status !== STATUS.OCUPADO && room.status !== STATUS.RESERVADO;

// ── Elapsed timer (for Day Use) ───────────────────────────────────────────────
function ElapsedTimer({ checkin }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor(
        (Date.now() - new Date(String(checkin).replace(' ', 'T')).getTime()) / 1000
      ));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkin]);
  return <span className={styles.timer}>{elapsed}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoomsManagement() {
  const [quartos, setQuartos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [collapsed, setCollapsed]       = useState({});
  const [notification, setNotif]        = useState(null);

  // Detail modal
  const [detailRoom, setDetailRoom] = useState(null);

  // Form modal (create / edit)
  const [formModal, setFormModal]     = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData]       = useState(blankForm());
  const [formSaving, setFormSaving]   = useState(false);

  // Service modal (limpeza / manutenção / fora)
  const [serviceModal, setServiceModal]     = useState(null);
  const [serviceForm, setServiceForm]       = useState(blankService());
  const [serviceLoading, setServiceLoading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Notify ──────────────────────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  };

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try { setQuartos(await quartoApi.listar()); }
    catch (e) { notify('Erro ao carregar quartos: ' + e.message, 'error'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredQuartos = quartos.filter((q) => {
    const statusOk = statusFilter === 'all' || q.status === statusFilter;
    const term     = search.toLowerCase();
    const searchOk = !search
      || q.numero.includes(search)
      || q.descricao.toLowerCase().includes(term)
      || (q.hospede?.nome || '').toLowerCase().includes(term);
    return statusOk && searchOk;
  });

  const byCategory = ROOM_CATEGORIES.map((cat) => ({
    ...cat,
    rooms:       filteredQuartos.filter((q) => q.categoriaId === cat.id),
    total:       quartos.filter((q) => q.categoriaId === cat.id).length,
    disponiveis: quartos.filter((q) => q.categoriaId === cat.id && q.status === STATUS.DISPONIVEL).length,
    ocupados:    quartos.filter((q) => q.categoriaId === cat.id && [STATUS.OCUPADO, STATUS.RESERVADO].includes(q.status)).length,
    emServico:   quartos.filter((q) => q.categoriaId === cat.id && [STATUS.LIMPEZA, STATUS.MANUTENCAO, STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  }));

  // ── Category collapse ────────────────────────────────────────────────────────
  const toggleCollapse = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormData(blankForm()); setEditingRoom(null); setFormModal('create');
  };

  const openEdit = (room) => {
    setFormData({
      numero:       room.numero,
      categoriaId:  room.categoriaId,
      tipoOcupacao: room.tipoOcupacao || 'Casal',
      descricao:    room.descricao,
      camas:        { ...room.camas },
    });
    setEditingRoom(room);
    setFormModal('edit');
  };

  const setField = (k, v) => setFormData((f) => ({ ...f, [k]: v }));
  const setCama  = (k, v) => setFormData((f) => ({ ...f, camas: { ...f.camas, [k]: Math.max(0, Number(v) || 0) } }));
  const isFormValid = formData.numero.trim() && formData.categoriaId;

  const handleSave = async () => {
    setFormSaving(true);
    try {
      const payload = { ...formData, categoriaId: Number(formData.categoriaId) };
      if (formModal === 'create') { await quartoApi.criar(payload);                      notify('Quarto criado com sucesso!'); }
      else                        { await quartoApi.atualizar(editingRoom.id, payload);  notify('Quarto atualizado com sucesso!'); }
      setFormModal(null);
      load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally     { setFormSaving(false); }
  };

  // ── Service actions ──────────────────────────────────────────────────────────
  const openService = (room, type, closeFirst = null) => {
    if (closeFirst === 'detail') setDetailRoom(null);
    if (closeFirst === 'form')   setFormModal(null);
    setServiceModal({ room, type });
    setServiceForm(blankService());
  };

  const handleService = async () => {
    if (!serviceModal) return;
    setServiceLoading(true);
    const { room, type } = serviceModal;
    const novoStatus = type === 'limpeza' ? STATUS.LIMPEZA : type === 'manutencao' ? STATUS.MANUTENCAO : STATUS.FORA_DE_SERVICO;
    try {
      await quartoApi.alterarStatus(room.id, novoStatus, serviceForm);
      notify(`Quarto ${room.numero} → ${novoStatus}.`);
      setServiceModal(null);
      load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally     { setServiceLoading(false); }
  };

  const handleMarkDisponivel = async (room, closeFirst = null) => {
    if (closeFirst === 'detail') setDetailRoom(null);
    if (closeFirst === 'form')   setFormModal(null);
    try {
      await quartoApi.alterarStatus(room.id, STATUS.DISPONIVEL);
      notify(`Quarto ${room.numero} marcado como Disponível.`);
      load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await quartoApi.excluir(deleteTarget.id);
      notify('Quarto removido.');
      setDeleteTarget(null); setDetailRoom(null);
      load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally     { setDeleting(false); }
  };

  // ── Status action buttons (reusable, context-aware) ──────────────────────────
  const StatusActions = ({ room, closeFirst }) => {
    if (!canChangeStatus(room)) return null;
    const s = room.status;
    return (
      <div className={styles.actionGroup}>
        {s === STATUS.DISPONIVEL && (<>
          <button className={[styles.actionBtn, styles.actionBtnBlue].join(' ')} onClick={() => openService(room, 'limpeza', closeFirst)}>
            <Sparkles size={13} /> Acionar Limpeza
          </button>
          <button className={[styles.actionBtn, styles.actionBtnIndigo].join(' ')} onClick={() => openService(room, 'manutencao', closeFirst)}>
            <Wrench size={13} /> Acionar Manutenção
          </button>
          <button className={[styles.actionBtn, styles.actionBtnSlate].join(' ')} onClick={() => openService(room, 'fora', closeFirst)}>
            Fora de Serviço
          </button>
        </>)}
        {s === STATUS.LIMPEZA && (
          <button className={[styles.actionBtn, styles.actionBtnGreen].join(' ')} onClick={() => handleMarkDisponivel(room, closeFirst)}>
            <BedDouble size={13} /> Marcar Disponível
          </button>
        )}
        {s === STATUS.MANUTENCAO && (<>
          <button className={[styles.actionBtn, styles.actionBtnGreen].join(' ')} onClick={() => handleMarkDisponivel(room, closeFirst)}>
            <BedDouble size={13} /> Marcar Disponível
          </button>
          <button className={[styles.actionBtn, styles.actionBtnSlate].join(' ')} onClick={() => openService(room, 'fora', closeFirst)}>
            Fora de Serviço
          </button>
        </>)}
        {s === STATUS.FORA_DE_SERVICO && (<>
          <button className={[styles.actionBtn, styles.actionBtnIndigo].join(' ')} onClick={() => openService(room, 'manutencao', closeFirst)}>
            <Wrench size={13} /> Acionar Manutenção
          </button>
          <button className={[styles.actionBtn, styles.actionBtnGreen].join(' ')} onClick={() => handleMarkDisponivel(room, closeFirst)}>
            <BedDouble size={13} /> Marcar Disponível
          </button>
        </>)}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>

        {/* ── Main card ── */}
        <div className={styles.card}>
          {/* Toolbar */}
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Quartos</h2>
              <p className={styles.subtitle}>{quartos.length} quartos cadastrados</p>
            </div>
            <div className={styles.tableTools}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar quarto..."
                  className={styles.searchInput}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: 148 }}
              >
                <option value="all">Todos os status</option>
                {Object.values(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Button variant="primary" onClick={openCreate}><Plus size={15} /> Novo Quarto</Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className={styles.empty}><Loader2 size={28} className={styles.spin} /><span>Carregando...</span></div>
          ) : quartos.length === 0 ? (
            <div className={styles.empty}><BedDouble size={32} color="var(--text-2)" /><span>Nenhum quarto cadastrado</span></div>
          ) : (
            byCategory.map((cat) => (
              <div key={cat.id} className={styles.catSection}>
                <div className={styles.catHeader} onClick={() => toggleCollapse(cat.id)}>
                  <div className={styles.catHeaderLeft}>
                    <ChevronDown size={16} className={[styles.catChevron, collapsed[cat.id] ? styles.catChevronClosed : ''].join(' ')} />
                    <div>
                      <span className={styles.catName}>{cat.tipo}</span>
                      <span className={styles.catDesc}>{cat.descricao}</span>
                    </div>
                  </div>
                  <div className={styles.catStats}>
                    <span className={[styles.catStat, styles.catStat_green].join(' ')}>{cat.disponiveis} disponíveis</span>
                    <span className={[styles.catStat, styles.catStat_red].join(' ')}>{cat.ocupados} ocupados</span>
                    {cat.emServico > 0 && <span className={[styles.catStat, styles.catStat_indigo].join(' ')}>{cat.emServico} em serviço</span>}
                    <span className={styles.catCount}>{cat.total} quartos</span>
                  </div>
                </div>

                {!collapsed[cat.id] && (
                  <div className={styles.catBody}>
                    {cat.rooms.length === 0 ? (
                      <div className={styles.catEmpty}>Nenhum quarto com os filtros atuais.</div>
                    ) : (
                      <div className={styles.roomGrid}>
                        {cat.rooms.map((room) => {
                          const sk     = STATUS_KEY[room.status] || 'slate';
                          const hasBeds = Object.values(room.camas || {}).some((v) => v > 0);
                          const isDayUse = room.status === STATUS.OCUPADO && room.hospede?.tipo === 'dayuse';
                          return (
                            <div
                              key={room.id}
                              className={[styles.roomCard, styles[`roomCard_${sk}`]].join(' ')}
                              onClick={() => setDetailRoom(room)}
                            >
                              <div className={styles.roomCardTop}>
                                <span className={styles.roomNum}>{room.numero}</span>
                                <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{room.status}</span>
                              </div>

                              {/* Tipo de ocupação */}
                              <span className={styles.tipoOcupacaoBadge}>{room.tipoOcupacao}</span>

                              {/* Disponível: mostrar camas */}
                              {room.status === STATUS.DISPONIVEL && hasBeds && (
                                <div className={styles.roomBeds}>
                                  {Object.entries(room.camas).map(([k, v]) =>
                                    v > 0 ? <span key={k} className={styles.roomBedPill}>{BEDS_LABELS_SH[k]} {v}</span> : null
                                  )}
                                </div>
                              )}

                              {/* Ocupado / Reservado */}
                              {(room.status === STATUS.OCUPADO || room.status === STATUS.RESERVADO) && room.hospede && (
                                <div className={styles.roomTimes}>
                                  <span className={styles.roomGuestName}>{room.hospede.nome}</span>
                                  {isDayUse ? (
                                    <div className={styles.dayUseRow}>
                                      <span className={styles.dayUseLabel}>Day Use</span>
                                      <ElapsedTimer checkin={room.hospede.checkin} />
                                    </div>
                                  ) : (
                                    <>
                                      <div className={styles.roomTimeRow}>
                                        <Clock size={9} /><span>In {fmtDate(room.hospede.checkin)}</span>
                                      </div>
                                      <div className={styles.roomTimeRow}>
                                        <Clock size={9} /><span>Out {fmtDate(room.hospede.checkout)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Limpeza */}
                              {room.status === STATUS.LIMPEZA && room.limpeza && (
                                <div className={styles.roomInfo}><Sparkles size={9} /><span>{room.limpeza.responsavel || 'Não atribuído'}</span></div>
                              )}

                              {/* Manutenção / Fora */}
                              {(room.status === STATUS.MANUTENCAO || room.status === STATUS.FORA_DE_SERVICO) && room.manutencao && (
                                <div className={styles.roomInfo}><Wrench size={9} /><span>{room.manutencao.responsavel || '—'}</span></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Detalhe do Quarto
      ═══════════════════════════════════════════════════════ */}
      {detailRoom && (
        <Modal
          open={!!detailRoom}
          onClose={() => setDetailRoom(null)}
          size="sm"
          title={<><BedDouble size={15} /> Quarto {detailRoom.numero}</>}
          footer={
            <div className={styles.modalFooterBetween}>
              <Button variant="danger" onClick={() => { const r = detailRoom; setDetailRoom(null); setDeleteTarget(r); }}>
                <Trash2 size={14} /> Excluir
              </Button>
              <Button variant="primary" onClick={() => { const r = detailRoom; setDetailRoom(null); openEdit(r); }}>
                <Edit2 size={14} /> Editar
              </Button>
            </div>
          }
        >
          <div className={styles.detailBody}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <span className={[styles.statusBadge, styles[`badge_${STATUS_KEY[detailRoom.status]}`]].join(' ')} style={{ fontSize: 11, padding: '3px 8px' }}>
                {detailRoom.status}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Categoria</span>
              <span className={styles.infoVal}>{ROOM_CATEGORIES.find((c) => c.id === detailRoom.categoriaId)?.tipo || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Tipo de Ocupação</span>
              <span className={styles.infoVal}>{detailRoom.tipoOcupacao || '—'}</span>
            </div>
            {detailRoom.descricao && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Descrição</span>
                <span className={styles.infoVal}>{detailRoom.descricao}</span>
              </div>
            )}

            {/* Beds */}
            {Object.entries(detailRoom.camas || {}).some(([, v]) => v > 0) && (
              <div className={styles.contextSection}>
                <span className={styles.sectionTitle}>Camas</span>
                <div className={styles.bedsList}>
                  {Object.entries(detailRoom.camas || {}).map(([k, v]) =>
                    v > 0 ? <span key={k} className={styles.bedBadge}>{BEDS_LABELS[k]} × {v}</span> : null
                  )}
                </div>
              </div>
            )}

            {/* Guest */}
            {(detailRoom.status === STATUS.OCUPADO || detailRoom.status === STATUS.RESERVADO) && detailRoom.hospede && (
              <div className={styles.contextSection}>
                <span className={styles.sectionTitle}><User size={12} /> Hóspede</span>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Nome</span><span className={styles.infoVal}>{detailRoom.hospede.nome}</span></div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo</span><span className={styles.infoVal}>{detailRoom.hospede.tipo === 'dayuse' ? 'Day Use' : 'Pernoite'}</span></div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Check-in</span><span className={styles.infoVal}>{detailRoom.hospede.checkin}</span></div>
                {detailRoom.hospede.checkout && <div className={styles.infoRow}><span className={styles.infoLabel}>Check-out</span><span className={styles.infoVal}>{detailRoom.hospede.checkout}</span></div>}
              </div>
            )}

            {/* Cleaning */}
            {detailRoom.status === STATUS.LIMPEZA && detailRoom.limpeza && (
              <div className={styles.contextSection}>
                <span className={styles.sectionTitle}><Sparkles size={12} /> Em Limpeza</span>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Responsável</span><span className={styles.infoVal}>{detailRoom.limpeza.responsavel || 'Não atribuído'}</span></div>
              </div>
            )}

            {/* Maintenance */}
            {(detailRoom.status === STATUS.MANUTENCAO || detailRoom.status === STATUS.FORA_DE_SERVICO) && detailRoom.manutencao && (
              <div className={styles.contextSection}>
                <span className={styles.sectionTitle}><Wrench size={12} /> Manutenção</span>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Responsável</span><span className={styles.infoVal}>{detailRoom.manutencao.responsavel || '—'}</span></div>
                {detailRoom.manutencao.descricao && <div className={styles.infoRow}><span className={styles.infoLabel}>Descrição</span><span className={styles.infoVal}>{detailRoom.manutencao.descricao}</span></div>}
                {detailRoom.manutencao.previsaoFim && <div className={styles.infoRow}><span className={styles.infoLabel}>Previsão</span><span className={styles.infoVal}>{detailRoom.manutencao.previsaoFim}</span></div>}
              </div>
            )}

            <StatusActions room={detailRoom} closeFirst="detail" />
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Quarto
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!formModal}
        onClose={() => setFormModal(null)}
        size="sm"
        title={formModal === 'create' ? <><BedDouble size={15} /> Novo Quarto</> : <><Edit2 size={15} /> Editar Quarto</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setFormModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} disabled={!isFormValid || formSaving}>
              {formSaving && <Loader2 size={14} className={styles.spinInline} />}
              {formModal === 'create' ? 'Criar Quarto' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <div className={styles.formRow}>
            <FormField label="Número *">
              <Input value={formData.numero} onChange={(e) => setField('numero', e.target.value)} placeholder="Ex: 11" maxLength={4} />
            </FormField>
            <FormField label="Categoria *">
              <Select value={formData.categoriaId} onChange={(e) => setField('categoriaId', Number(e.target.value))}>
                {ROOM_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.tipo}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Tipo de Ocupação">
            <Select value={formData.tipoOcupacao} onChange={(e) => setField('tipoOcupacao', e.target.value)}>
              {TIPOS_OCUPACAO.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Descrição">
            <Input value={formData.descricao} onChange={(e) => setField('descricao', e.target.value)} placeholder="Descrição do quarto" />
          </FormField>
          <span className={styles.sectionTitle}>Camas</span>
          <div className={styles.bedsGrid}>
            {Object.keys(BEDS_LABELS).map((k) => (
              <div key={k} className={styles.bedCell}>
                <span className={styles.bedLabel}>{BEDS_LABELS[k]}</span>
                <Input type="number" min="0" max="10" value={formData.camas[k]} onChange={(e) => setCama(k, e.target.value)} />
              </div>
            ))}
          </div>

          {/* Status change — only when editing a non-occupied/reserved room */}
          {formModal === 'edit' && editingRoom && canChangeStatus(editingRoom) && (
            <div className={styles.contextSection}>
              <span className={styles.sectionTitle}>Alterar Status</span>
              <StatusActions room={editingRoom} closeFirst="form" />
            </div>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Acionar Serviço
      ═══════════════════════════════════════════════════════ */}
      {serviceModal && (
        <Modal
          open={!!serviceModal}
          onClose={() => setServiceModal(null)}
          size="sm"
          title={
            serviceModal.type === 'limpeza'
              ? <><Sparkles size={15} /> Acionar Limpeza — Q.{serviceModal.room.numero}</>
              : serviceModal.type === 'manutencao'
              ? <><Wrench size={15} /> Acionar Manutenção — Q.{serviceModal.room.numero}</>
              : <><AlertTriangle size={15} /> Fora de Serviço — Q.{serviceModal.room.numero}</>
          }
          footer={
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setServiceModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleService} disabled={serviceLoading}>
                {serviceLoading && <Loader2 size={14} className={styles.spinInline} />}
                Confirmar
              </Button>
            </div>
          }
        >
          <div className={styles.formBody}>
            <FormField label="Responsável">
              <Input value={serviceForm.responsavel} onChange={(e) => setServiceForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável (opcional)" />
            </FormField>
            {serviceModal.type !== 'limpeza' && (<>
              <FormField label="Descrição">
                <Input value={serviceForm.descricao} onChange={(e) => setServiceForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço a ser realizado" />
              </FormField>
              <FormField label="Previsão de término">
                <Input type="date" value={serviceForm.previsaoFim} onChange={(e) => setServiceForm((f) => ({ ...f, previsaoFim: e.target.value }))} />
              </FormField>
            </>)}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmar Exclusão
      ═══════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          size="sm"
          title="Excluir Quarto"
          footer={
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                {deleting && <Loader2 size={14} className={styles.spinInline} />}
                Excluir
              </Button>
            </div>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
            Deseja excluir o <strong>Quarto {deleteTarget.numero}</strong>?<br />
            Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )}
    </div>
  );
}

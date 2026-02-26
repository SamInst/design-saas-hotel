import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Loader2, ShieldCheck, Edit2,
  Lock, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button }                from '../../components/ui/Button';
import { Modal }                 from '../../components/ui/Modal';
import { Input, FormField }      from '../../components/ui/Input';
import { Notification }          from '../../components/ui/Notification';
import { cargoApi, permissaoApi } from '../../services/api';

import styles from './RolePermissions.module.css';

const PAGE_SIZE = 10;
const up = v => (v ?? '').toUpperCase().trim();

// ── main component ───────────────────────────────────────────
export default function RolePermissions() {

  // ── list ──────────────────────────────────────────────────
  const [cargos, setCargos]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [page, setPage]                   = useState(0);
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch]               = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // ── system data ───────────────────────────────────────────
  const [systemTelas, setSystemTelas]           = useState([]);
  const [systemPerms, setSystemPerms]           = useState({});   // { telaId: [perm] }
  const [loadingPerms, setLoadingPerms]         = useState({});   // { telaId: bool }
  const [systemDataLoaded, setSystemDataLoaded] = useState(false);

  // ── modals ────────────────────────────────────────────────
  const [detailModal,   setDetailModal]   = useState(false);
  const [formModal,     setFormModal]     = useState(false);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [isEditing,     setIsEditing]     = useState(false);

  // ── form ──────────────────────────────────────────────────
  const [formDescricao,     setFormDescricao]     = useState('');
  const [formTelasIds,      setFormTelasIds]      = useState(new Set());
  const [formPermissoesIds, setFormPermissoesIds] = useState(new Set());
  const [formAcessoTotal,   setFormAcessoTotal]   = useState(new Set()); // telas com acesso total

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const searchTimer = useRef(null);

  // ── helpers ───────────────────────────────────────────────
  const notify = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ── load cargos ───────────────────────────────────────────
  const loadCargos = useCallback(async (pageNum = 0, termo = '') => {
    setLoading(true);
    try {
      const params = { page: pageNum, size: PAGE_SIZE };
      if (termo) params.termo = termo;
      const data = await cargoApi.listar(params);
      setCargos(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
    } catch (err) {
      notify(err.message || 'Erro ao carregar cargos', 'error');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadCargos(0, ''); }, [loadCargos]);

  // ── search ────────────────────────────────────────────────
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(0);
    clearTimeout(searchTimer.current);
    if (val.length === 0 || val.length >= 3) {
      setSearchLoading(true);
      searchTimer.current = setTimeout(() => loadCargos(0, val), 400);
    }
  };

  const handlePageChange = (p) => { setPage(p); loadCargos(p, search); };

  // ── system telas / permissoes ─────────────────────────────
  const loadSystemData = useCallback(async () => {
    if (systemDataLoaded) return;
    try {
      const telas = await permissaoApi.listarTelas();
      setSystemTelas(telas ?? []);
      setSystemDataLoaded(true);
    } catch { /* silencioso */ }
  }, [systemDataLoaded]);

  const loadPermsForTela = useCallback(async (telaId) => {
    if (systemPerms[telaId] !== undefined) return;
    setLoadingPerms(prev => ({ ...prev, [telaId]: true }));
    try {
      const perms = await permissaoApi.listarPermissoesPorTela(telaId);
      setSystemPerms(prev => ({ ...prev, [telaId]: perms ?? [] }));
    } catch {
      setSystemPerms(prev => ({ ...prev, [telaId]: [] }));
    } finally {
      setLoadingPerms(prev => ({ ...prev, [telaId]: false }));
    }
  }, [systemPerms]);

  // ── open detail ───────────────────────────────────────────
  const openDetail = (cargo) => { setSelectedCargo(cargo); setDetailModal(true); };

  // ── open create ───────────────────────────────────────────
  const openCreate = async () => {
    setIsEditing(false);
    setSelectedCargo(null);
    setFormDescricao('');
    setFormTelasIds(new Set());
    setFormPermissoesIds(new Set());
    setFormAcessoTotal(new Set());
    await loadSystemData();
    setFormModal(true);
  };

  // ── open edit ─────────────────────────────────────────────
  const openEdit = async (cargo) => {
    setIsEditing(true);
    setSelectedCargo(cargo);
    setFormDescricao(cargo.cargo ?? '');

    const telaIds = new Set((cargo.telas ?? []).map(t => t.id));
    setFormTelasIds(telaIds);

    const permIds = new Set(
      (cargo.telas ?? []).flatMap(t => (t.permissoes ?? []).map(p => p.id))
    );
    setFormPermissoesIds(permIds);
    setFormAcessoTotal(new Set());

    await loadSystemData();
    for (const tela of (cargo.telas ?? [])) loadPermsForTela(tela.id);

    setDetailModal(false);
    setFormModal(true);
  };

  // ── toggle tela ───────────────────────────────────────────
  const toggleTela = (telaId) => {
    setFormTelasIds(prev => {
      const next = new Set(prev);
      if (next.has(telaId)) {
        next.delete(telaId);
        // remove permissões e acesso total desta tela
        const permsOfTela = (systemPerms[telaId] ?? []).map(p => p.id);
        setFormPermissoesIds(pp => {
          const np = new Set(pp); permsOfTela.forEach(id => np.delete(id)); return np;
        });
        setFormAcessoTotal(at => {
          const na = new Set(at); na.delete(telaId); return na;
        });
      } else {
        next.add(telaId);
        loadPermsForTela(telaId);
      }
      return next;
    });
  };

  // ── toggle acesso total ───────────────────────────────────
  const toggleAcessoTotal = (telaId) => {
    const perms = systemPerms[telaId] ?? [];
    setFormAcessoTotal(prev => {
      const next = new Set(prev);
      if (next.has(telaId)) {
        next.delete(telaId);
        // mantém permissões selecionadas (usuário decide quais manter)
      } else {
        next.add(telaId);
        // seleciona todas as permissões da tela
        setFormPermissoesIds(pp => {
          const np = new Set(pp);
          perms.forEach(p => np.add(p.id));
          return np;
        });
      }
      return next;
    });
  };

  // ── toggle permissao ──────────────────────────────────────
  const togglePermissao = (permId) => {
    setFormPermissoesIds(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
  };

  // ── create ────────────────────────────────────────────────
  const handleCreate = async () => {
    const desc = up(formDescricao);
    if (!desc) { notify('Informe o nome do cargo', 'error'); return; }
    setSaving(true);
    try {
      await cargoApi.criar({
        descricao: desc,
        telasIds: [...formTelasIds],
        permissoesIds: [...formPermissoesIds],
      });
      notify('Cargo criado com sucesso!');
      setFormModal(false);
      loadCargos(0, search);
    } catch (err) {
      notify(err.message || 'Erro ao criar cargo', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── update ────────────────────────────────────────────────
  const handleUpdate = async () => {
    const desc = up(formDescricao);
    if (!desc) { notify('Informe o nome do cargo', 'error'); return; }
    setSaving(true);
    try {
      const cargo = selectedCargo;
      if (desc !== up(cargo.cargo)) await cargoApi.atualizar(cargo.id, { descricao: desc });

      const originalTelaIds = new Set((cargo.telas ?? []).map(t => t.id));
      const telasToAdd      = [...formTelasIds].filter(id => !originalTelaIds.has(id));
      const telasToRemove   = [...originalTelaIds].filter(id => !formTelasIds.has(id));
      if (telasToAdd.length)    await cargoApi.vincularTelas(cargo.id, telasToAdd, true);
      if (telasToRemove.length) await cargoApi.vincularTelas(cargo.id, telasToRemove, false);

      const originalPermIds = new Set(
        (cargo.telas ?? []).flatMap(t => (t.permissoes ?? []).map(p => p.id))
      );
      const permsToAdd    = [...formPermissoesIds].filter(id => !originalPermIds.has(id));
      const permsToRemove = [...originalPermIds].filter(id => !formPermissoesIds.has(id));
      if (permsToAdd.length)    await cargoApi.vincularPermissoes(cargo.id, permsToAdd, true);
      if (permsToRemove.length) await cargoApi.vincularPermissoes(cargo.id, permsToRemove, false);

      notify('Cargo atualizado com sucesso!');
      setFormModal(false);
      loadCargos(page, search);
    } catch (err) {
      notify(err.message || 'Erro ao atualizar cargo', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── pagination ────────────────────────────────────────────
  const pageButtons = () => {
    const btns = [];
    const start = Math.max(0, page - 2);
    const end   = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) btns.push(i);
    return btns;
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── CARD ── */}
        <div className={styles.card}>

          {/* toolbar inside card */}
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Cargos e Permissões</h2>
              <p className={styles.subtitle}>Gestão de cargos e controle de acesso</p>
            </div>
            <div className={styles.tableTools}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <Input
                  className={styles.searchInput}
                  placeholder="Buscar cargo..."
                  value={search}
                  onChange={handleSearch}
                />
                {searchLoading && (
                  <Loader2 size={14} className={[styles.searchSpinner, styles.spin].join(' ')} />
                )}
              </div>
              <Button variant="primary" onClick={openCreate}>
                <Plus size={15} />
                Novo Cargo
              </Button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            {loading ? (
              <div className={styles.empty}>
                <Loader2 size={22} className={styles.spin} />
                Carregando cargos…
              </div>
            ) : cargos.length === 0 ? (
              <div className={styles.empty}>
                <ShieldCheck size={28} style={{ opacity: .3 }} />
                Nenhum cargo encontrado
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Cargo</th>
                    <th>Telas vinculadas</th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map(cargo => (
                    <tr key={cargo.id} className={styles.row} onClick={() => openDetail(cargo)}>
                      <td><span className={styles.cargoId}>#{cargo.id}</span></td>
                      <td><span className={styles.cargoName}>{cargo.cargo}</span></td>
                      <td><TelaTags telas={cargo.telas ?? []} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => handlePageChange(page - 1)} disabled={page === 0}>
                <ChevronLeft size={14} />
              </button>
              {pageButtons().map(p => (
                <button
                  key={p}
                  className={[styles.pageBtn, p === page ? styles.pageBtnActive : ''].join(' ')}
                  onClick={() => handlePageChange(p)}
                >
                  {p + 1}
                </button>
              ))}
              <button className={styles.pageBtn} onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight size={14} />
              </button>
              <span className={styles.pageInfo}>{totalElements} resultado{totalElements !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      <Modal
        open={detailModal}
        onClose={() => setDetailModal(false)}
        title={
          selectedCargo
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={15} style={{ color: 'var(--violet)', flexShrink: 0 }} />
                <span>{selectedCargo.cargo}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', fontWeight: 400 }}>
                  #{selectedCargo.id}
                </span>
              </span>
            : 'Cargo'
        }
        size="md"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="primary" className={styles.full} onClick={() => openEdit(selectedCargo)}>
              <Edit2 size={14} />
              Editar
            </Button>
          </div>
        }
      >
        {selectedCargo && (
          <div>
            <div className={styles.detailSectionTitle}>
              <Lock size={12} />
              Telas e Permissões
            </div>

            {(selectedCargo.telas ?? []).length === 0 ? (
              <div className={styles.detailNoTelas}>
                <ShieldCheck size={24} style={{ opacity: .25 }} />
                Nenhuma tela vinculada
              </div>
            ) : (
              <div className={styles.detailTelas}>
                {(selectedCargo.telas ?? []).map(tela => (
                  <div key={tela.id} className={styles.detailTelaCard}>
                    <div className={styles.detailTelaHeader}>
                      <div className={styles.detailTelaIcon}>
                        <ShieldCheck size={13} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={styles.detailTelaName}>{tela.nome ?? tela.descricao}</div>
                        {tela.descricao && tela.nome && (
                          <div className={styles.detailTelaDesc}>{tela.descricao}</div>
                        )}
                      </div>
                    </div>

                    {(tela.permissoes ?? []).length === 0 ? (
                      <div className={styles.detailPermEmpty}>Sem permissões específicas</div>
                    ) : (
                      <div className={styles.detailPermList}>
                        {(tela.permissoes ?? []).map(p => (
                          <div key={p.id} className={styles.detailPermItem}>
                            <span className={styles.detailPermBullet} />
                            <span>{p.descricao ?? p.permissao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── CREATE / EDIT MODAL ── */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={isEditing ? `Editar: ${selectedCargo?.cargo ?? ''}` : 'Novo Cargo'}
        size="md"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" className={styles.full} onClick={() => setFormModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className={styles.full}
              onClick={isEditing ? handleUpdate : handleCreate}
              disabled={saving}
            >
              {saving && <Loader2 size={14} className={styles.spin} />}
              {isEditing ? 'Salvar alterações' : 'Criar cargo'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Nome do cargo *">
            <Input
              placeholder="Ex: GERENTE, RECEPCIONISTA..."
              value={formDescricao}
              onChange={e => setFormDescricao(e.target.value.toUpperCase())}
              disabled={saving}
            />
          </FormField>

          <div className={styles.formDivider} />

          <div className={styles.telasSection}>
            <div className={styles.telasSectionTitle}>
              <Lock size={12} />
              Telas e Permissões
            </div>

            {!systemDataLoaded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-2)', fontSize: 13 }}>
                <Loader2 size={14} className={styles.spin} />
                Carregando telas…
              </div>
            ) : systemTelas.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Nenhuma tela disponível</div>
            ) : (
              systemTelas.map(tela => {
                const isChecked    = formTelasIds.has(tela.id);
                const hasTotal     = formAcessoTotal.has(tela.id);
                const perms        = systemPerms[tela.id];
                const permsLoading = loadingPerms[tela.id];

                return (
                  <div key={tela.id} className={[styles.telaItem, isChecked ? styles.telaItemActive : ''].join(' ')}>

                    {/* header da tela */}
                    <div
                      className={[styles.telaItemHeader, isChecked ? styles.telaItemHeaderActive : ''].join(' ')}
                      onClick={() => toggleTela(tela.id)}
                    >
                      <input
                        type="checkbox"
                        className={styles.telaCheckbox}
                        checked={isChecked}
                        onChange={() => toggleTela(tela.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className={styles.telaInfo}>
                        <div className={styles.telaNome}>{tela.descricao}</div>
                      </div>
                    </div>

                    {/* permissões (só quando a tela está ativa) */}
                    {isChecked && (
                      permsLoading ? (
                        <div className={styles.permissaoLoading}>
                          <Loader2 size={13} className={styles.spin} />
                          Carregando permissões…
                        </div>
                      ) : !perms || perms.length === 0 ? (
                        <div className={styles.permissaoEmpty}>Nenhuma permissão disponível para esta tela</div>
                      ) : (
                        <>
                          {/* Acesso Total */}
                          <label
                            className={styles.acessoTotalRow}
                            onClick={() => toggleAcessoTotal(tela.id)}
                          >
                            <input
                              type="checkbox"
                              className={styles.acessoTotalCheckbox}
                              checked={hasTotal}
                              onChange={() => toggleAcessoTotal(tela.id)}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className={styles.acessoTotalLabel}>Acesso Total</span>
                            {hasTotal && (
                              <span className={styles.acessoTotalBadge}>Todas selecionadas</span>
                            )}
                          </label>

                          {/* Lista de permissões (exclui "ACESSO TOTAL" pois já está no toggle) */}
                          <div className={styles.permissoesList}>
                            {perms.filter(p => (p.descricao ?? '').toUpperCase() !== 'ACESSO TOTAL').map(perm => (
                              <label
                                key={perm.id}
                                className={[
                                  styles.permissaoItem,
                                  hasTotal ? styles.permissaoItemDisabled : '',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  className={styles.permissaoCheckbox}
                                  checked={formPermissoesIds.has(perm.id)}
                                  onChange={() => !hasTotal && togglePermissao(perm.id)}
                                  disabled={hasTotal}
                                />
                                <span className={styles.permissaoLabel}>{perm.descricao}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}

// ── TelaTags ─────────────────────────────────────────────────
function TelaTags({ telas }) {
  if (!telas || telas.length === 0) return <span className={styles.telaTagEmpty}>—</span>;
  const visible = telas.slice(0, 3);
  const rest    = telas.length - visible.length;
  return (
    <div className={styles.telaTags}>
      {visible.map(t => (
        <span key={t.id} className={styles.telaTag}>{t.nome ?? t.descricao}</span>
      ))}
      {rest > 0 && <span className={styles.telaTagMore}>+{rest}</span>}
    </div>
  );
}

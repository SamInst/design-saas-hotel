import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Loader2, ShieldCheck, Edit2,
  Lock, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button }                from '../../components/ui/Button';
import { Modal }                 from '../../components/ui/Modal';
import { Input, FormField }      from '../../components/ui/Input';
import { Notification }          from '../../components/ui/Notification';
import { cargoApi } from '../../services/api';

import styles from './RolePermissions.module.css';

const PAGE_SIZE = 10;
const up = v => (v ?? '').toUpperCase().trim();

// ── FINANCEIRO: cascade rules (checking A also checks B,C…) ──
const FINANCEIRO_CASCADES = {
  'APLICAR DESCONTO': ['EDITAR PAGAMENTO', 'EDITAR RELATORIO', 'NOVO RELATORIO'],
  'EDITAR RELATORIO': ['NOVO RELATORIO'],
  'EDITAR PAGAMENTO': ['NOVO RELATORIO'],
};
// permission auto-selected when FINANCEIRO tela is first enabled
const FINANCEIRO_AUTO = 'HISTORICO DO FLUXO DE CAIXA';
const isFinanceiro = tela => (tela?.nome ?? tela?.descricao ?? '').toUpperCase() === 'FINANCEIRO';

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
  const [systemDataLoaded, setSystemDataLoaded] = useState(false);
  const [permDescMap, setPermDescMap]           = useState({});   // { permId: descricao }

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
      const content = data?.content ?? [];
      setCargos(content);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
      // extrai descrições de permissões conhecidas
      const map = {};
      content.forEach(c => (c.telas ?? []).forEach(t =>
        (t.permissoes ?? []).forEach(p => { if (p.descricao) map[p.id] = p.descricao; })
      ));
      if (Object.keys(map).length) setPermDescMap(prev => ({ ...prev, ...map }));
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
      const telas = await cargoApi.listarTelas();
      setSystemTelas(telas ?? []);
      // pré-popula systemPerms e permDescMap de uma vez
      const permsMap = {};
      const descMap  = {};
      (telas ?? []).forEach(t => {
        permsMap[t.id] = t.permissoes ?? [];
        (t.permissoes ?? []).forEach(p => { if (p.descricao) descMap[p.id] = p.descricao; });
      });
      setSystemPerms(prev => ({ ...prev, ...permsMap }));
      setPermDescMap(prev => ({ ...prev, ...descMap }));
      setSystemDataLoaded(true);
    } catch { /* silencioso */ }
  }, [systemDataLoaded]);

  // mantido por compatibilidade (toggleTela ainda chama, mas retorna imediatamente pois já carregado)
  const loadPermsForTela = useCallback((telaId) => {
    void telaId; // systemPerms já preenchido em loadSystemData
  }, []);

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
    setFormDescricao(cargo.descricao ?? '');

    const telaIds = new Set((cargo.telas ?? []).map(t => t.id));
    setFormTelasIds(telaIds);

    const permIds = new Set(
      (cargo.telas ?? []).flatMap(t => (t.permissoes ?? []).map(p => p.id))
    );
    setFormPermissoesIds(permIds);

    // restaura o estado do toggle de Acesso Total por tela
    const acessoTotalTelaIds = new Set(
      (cargo.telas ?? []).filter(t =>
        (t.permissoes ?? []).some(p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL')
      ).map(t => t.id)
    );
    setFormAcessoTotal(acessoTotalTelaIds);

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
        // auto-select HISTORICO DO FLUXO DE CAIXA when FINANCEIRO is enabled
        const tela = systemTelas.find(t => t.id === telaId);
        if (isFinanceiro(tela)) {
          const perms = systemPerms[telaId] ?? [];
          const autoId = perms.find(p => p.permissao === FINANCEIRO_AUTO)?.id;
          if (autoId) {
            setFormPermissoesIds(pp => { const np = new Set(pp); np.add(autoId); return np; });
          }
        }
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
        // remove a permissão ACESSO TOTAL da lista (as demais o usuário decide)
        const acessoTotalPerm = (systemPerms[telaId] ?? []).find(
          p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL'
        );
        if (acessoTotalPerm) {
          setFormPermissoesIds(pp => {
            const np = new Set(pp);
            np.delete(acessoTotalPerm.id);
            return np;
          });
        }
      } else {
        next.add(telaId);
        // remove todas as permissões desta tela e adiciona só ACESSO TOTAL
        const allPermIds     = perms.map(p => p.id);
        const acessoTotalPerm = perms.find(
          p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL'
        );
        setFormPermissoesIds(pp => {
          const np = new Set(pp);
          allPermIds.forEach(id => np.delete(id));
          if (acessoTotalPerm) np.add(acessoTotalPerm.id);
          return np;
        });
      }
      return next;
    });
  };

  // ── toggle permissao ──────────────────────────────────────
  const togglePermissao = (permId, tela) => {
    setFormPermissoesIds(prev => {
      const next = new Set(prev);
      const adding = !next.has(permId);
      adding ? next.add(permId) : next.delete(permId);

      // cascade rules only when checking a permission in FINANCEIRO
      if (adding && isFinanceiro(tela)) {
        const perms = systemPerms[tela.id] ?? [];
        const code  = perms.find(p => p.id === permId)?.permissao ?? '';
        (FINANCEIRO_CASCADES[code] ?? []).forEach(cascadeCode => {
          const target = perms.find(p => p.permissao === cascadeCode);
          if (target) next.add(target.id);
        });
      }

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
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
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
      await cargoApi.atualizar({
        id: selectedCargo.id,
        descricao: desc,
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
      });
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
                      <td><span className={styles.cargoName}>{cargo.descricao}</span></td>
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
                <span>{selectedCargo.descricao}</span>
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
        title={isEditing ? `Editar: ${selectedCargo?.descricao ?? ''}` : 'Novo Cargo'}
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
                const perms = systemPerms[tela.id];

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
                        <div className={styles.telaNome}>{tela.nome ?? tela.descricao}</div>
                        {tela.nome && tela.descricao && (
                          <div className={styles.telaDesc}>{tela.descricao}</div>
                        )}
                      </div>
                    </div>

                    {/* permissões (só quando a tela está ativa) */}
                    {isChecked && (
                      !perms || perms.length === 0 ? (
                        <div className={styles.permissaoEmpty}>Nenhuma permissão disponível para esta tela</div>
                      ) : (
                        <>
                          {/* Acesso Total */}
                          <label className={styles.acessoTotalRow}>
                            <input
                              type="checkbox"
                              className={styles.acessoTotalCheckbox}
                              checked={hasTotal}
                              onChange={() => toggleAcessoTotal(tela.id)}
                            />
                            <span className={styles.acessoTotalLabel}>Acesso Total</span>
                            {hasTotal && (
                              <span className={styles.acessoTotalBadge}>Todas selecionadas</span>
                            )}
                          </label>

                          {/* Lista de permissões (exclui "ACESSO TOTAL" pois já está no toggle) */}
                          <div className={styles.permissoesList}>
                            {perms.filter(p => (p.permissao ?? p.descricao ?? '').toUpperCase() !== 'ACESSO TOTAL').map(perm => (
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
                                  onChange={() => !hasTotal && togglePermissao(perm.id, tela)}
                                  disabled={hasTotal}
                                />
                                <div className={styles.permissaoTexts}>
                                  {(() => {
                                    const title = perm.permissao ?? perm.descricao;
                                    const desc  = perm.descricao || permDescMap[perm.id];
                                    const showDesc = desc && desc !== title;
                                    return (
                                      <>
                                        <span className={styles.permissaoNome}>{title}</span>
                                        {showDesc && <span className={styles.permissaoDesc}>{desc}</span>}
                                      </>
                                    );
                                  })()}
                                </div>
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

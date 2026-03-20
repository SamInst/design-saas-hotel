import { useMemo } from 'react';
import { userStorage } from '../services/api';

/**
 * Hook global de permissões.
 *
 * Lê o funcionário logado do localStorage e monta um mapa de
 * permissões por tela, baseado em cargo.telas[].permissoes[].
 *
 * Uso:
 *   const { can, hasTela, loggedUser } = usePermissions();
 *   can('CADASTRO', 'CADASTRO')          // pode cadastrar?
 *   can('CADASTRO', 'ATUALIZAR')         // pode editar?
 *   can('CADASTRO', 'BLOQUEIO')          // pode bloquear?
 *   can('CADASTRO', 'ACESSO HISTORICO')  // pode ver histórico?
 *   hasTela('FINANCEIRO')                // tem acesso à tela?
 *
 * ACESSO TOTAL libera qualquer permissão da tela.
 */
export function usePermissions() {
  const rawUser = userStorage.get();

  const telaMap = useMemo(() => {
    const telas = rawUser?.cargo?.telas ?? [];
    const map = {};
    for (const tela of telas) {
      map[tela.nome] = new Set((tela.permissoes ?? []).map(p => p.permissao));
    }
    return map;
  }, [rawUser?.id, rawUser?.cargo?.id]);

  /** Verifica se o usuário tem acesso à tela (independente de permissão). */
  const hasTela = (nome) => !!telaMap[nome];

  /**
   * Verifica se o usuário pode executar uma ação na tela.
   * ACESSO TOTAL na tela libera qualquer permissão.
   */
  const can = (tela, permissao) => {
    const set = telaMap[tela];
    if (!set) return false;
    return set.has('ACESSO TOTAL') || set.has(permissao);
  };

  return {
    can,
    hasTela,
    loggedUser: rawUser,
  };
}

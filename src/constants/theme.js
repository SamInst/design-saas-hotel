// Tokens centralizados de tema — usados por todos os componentes
export const getTheme = (isDark) => ({
  bg:            isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
                        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
  bgOverlay:     isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent)]'
                        : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),transparent)]',
  text:          isDark ? 'text-white'          : 'text-slate-900',
  textSecondary: isDark ? 'text-slate-400'      : 'text-slate-600',
  card:          isDark ? 'bg-white/5 border-white/10'  : 'bg-white border-slate-200',
  cardHover:     isDark ? 'hover:bg-white/8'    : 'hover:bg-slate-50',
  input:         isDark ? 'bg-white/10 border-white/15 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400',
  tableHeader:   isDark ? 'bg-white/5'          : 'bg-slate-100',
  divider:       isDark ? 'border-white/10'     : 'border-slate-200',
  button:        isDark ? 'bg-white/10 hover:bg-white/20 border-white/10'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  sidebar:       isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
  sidebarActive: 'bg-violet-600 text-white',
  sidebarItem:   isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100',
});

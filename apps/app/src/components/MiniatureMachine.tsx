/**
 * Miniature d'une machine : l'image envoyée par l'admin (PNG conseillé), sinon une illustration
 * par défaut. Le badge (ex. « 300 W ») évite de confondre des variantes qui se ressemblent.
 */
const BASE = import.meta.env.VITE_API_URL ?? '';

export function MiniatureMachine({ url, badge, taille = 72, className = '' }: { url?: string | null; badge?: string; taille?: number; className?: string }) {
  return (
    <span className={'miniature ' + className} style={{ width: taille, height: taille }}>
      {url ? (
        <img src={BASE + url} alt="" loading="lazy" />
      ) : (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <rect x="10" y="26" width="30" height="24" rx="4" />
          <path d="M40 34h8l8-10M18 26v-6h14v6M16 50v4M34 50v4" />
          <path d="M56 24l3-3M56 24l4 1M56 24l1 4" strokeWidth="2" />
        </svg>
      )}
      {badge && <b className="mini-badge">{badge}</b>}
    </span>
  );
}

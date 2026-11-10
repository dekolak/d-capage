import { useAuth } from '../../lib/auth';
import { useEspace } from '../../lib/espace';

/** Guides machines (phase 2 : écrans et pastilles depuis kit-guides/guides/*.json). */
export default function Guides() {
  const { moi } = useAuth();
  const { espace } = useEspace();
  const guides = espace.modules.filter((m) => m.slug.startsWith('guide-') && (moi?.role === 'ADMIN' || moi?.modules.includes(m.slug)));
  return (
    <div className="page">
      <h1>Guides</h1>
      {guides.length ? (
        <div className="liste-modules">
          {guides.map((g) => (
            <div key={g.slug} className="carte module-carte">
              <b>{g.nom}</b>
              <span className="muted petit">Bientôt disponible</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Aucun guide n'est activé sur votre compte.</p>
      )}
    </div>
  );
}

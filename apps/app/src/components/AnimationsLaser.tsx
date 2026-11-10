import { t } from '../lib/i18n';
/**
 * Petites animations en boucle pour comprendre les réglages du laser pulsé.
 * Chaque animation compare deux valeurs (bas / haut) d'un même réglage.
 * Dessins simples en SVG ; respectent « réduire les animations » du téléphone.
 */
const L = 300; // largeur d'un motif répété (px) : le défilement boucle sans saut

function Impulsions({ periode, largeur, hauteur, couleur = 'var(--o)' }: { periode: number; largeur: number; hauteur: number; couleur?: string }) {
  const n = (2 * L) / periode;
  return (
    <g className="anim-defile">
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={i * periode + (periode - largeur) / 2} y={48 - hauteur} width={largeur} height={hauteur} rx={Math.min(3, largeur / 2)} fill={couleur} />
      ))}
    </g>
  );
}

function Taches({ ecart, rayon = 7 }: { ecart: number; rayon?: number }) {
  const n = (2 * L) / ecart;
  return (
    <g className="anim-defile">
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={i * ecart + ecart / 2} cy={28} r={rayon} fill="var(--o)" fillOpacity={0.45} stroke="var(--o)" strokeWidth={1} />
      ))}
    </g>
  );
}

function Ligne({ titre, note, children }: { titre: string; note: string; children: React.ReactNode }) {
  return (
    <div className="anim-ligne">
      <div className="anim-titre">
        <b>{titre}</b> <span>{note}</span>
      </div>
      <svg viewBox={`0 0 ${L} 52`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="48.5" x2={L} y2="48.5" stroke="#d4d5db" strokeWidth="1" />
        {children}
      </svg>
    </div>
  );
}

const ANIMATIONS: Record<string, () => React.ReactNode> = {
  pwr: () => (
    <>
      <Ligne titre={t('lazzeko.anim.puissanceBasse')} note={t('lazzeko.anim.puissanceBasseNote')}>
        <Impulsions periode={30} largeur={8} hauteur={14} />
      </Ligne>
      <Ligne titre={t('lazzeko.anim.puissanceHaute')} note={t('lazzeko.anim.puissanceHauteNote')}>
        <Impulsions periode={30} largeur={8} hauteur={44} />
      </Ligne>
    </>
  ),
  freq: () => (
    <>
      <Ligne titre={t('lazzeko.anim.frequenceBasse')} note={t('lazzeko.anim.frequenceBasseNote')}>
        <Impulsions periode={60} largeur={8} hauteur={44} />
      </Ligne>
      <Ligne titre={t('lazzeko.anim.frequenceHaute')} note={t('lazzeko.anim.frequenceHauteNote')}>
        <Impulsions periode={15} largeur={5} hauteur={12} />
      </Ligne>
    </>
  ),
  pw: () => (
    <>
      <Ligne titre={t('lazzeko.anim.impulsionCourte')} note={t('lazzeko.anim.impulsionCourteNote')}>
        <Impulsions periode={60} largeur={4} hauteur={46} />
      </Ligne>
      <Ligne titre={t('lazzeko.anim.impulsionLongue')} note={t('lazzeko.anim.impulsionLongueNote')}>
        <Impulsions periode={60} largeur={24} hauteur={12} couleur="#f59e0b" />
      </Ligne>
    </>
  ),
  speed: () => (
    <>
      <Ligne titre={t('lazzeko.anim.vitesseLente')} note={t('lazzeko.anim.vitesseLenteNote')}>
        <Taches ecart={10} />
      </Ligne>
      <Ligne titre={t('lazzeko.anim.vitesseRapide')} note={t('lazzeko.anim.vitesseRapideNote')}>
        <Taches ecart={30} />
      </Ligne>
    </>
  ),
};

export const aAnimation = (key: string) => key in ANIMATIONS;

export function AnimationReglage({ k }: { k: string }) {
  const a = ANIMATIONS[k];
  return a ? <div className="anim">{a()}</div> : null;
}

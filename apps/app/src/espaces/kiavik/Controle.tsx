import { Link } from 'react-router-dom';
import { t } from '../../lib/i18n';
import { Etape, useSolutions } from './donneesProcedures';

/** Réponses aux étapes de contrôle : ids des étapes répondues « Non » (gardées sur le téléphone). */
export const cleNon = (procedure: string) => `kiavik.controles.${procedure}`;

/** Boutons Oui / Non d'une étape de contrôle. */
export function OuiNon({ oui, non, onOui, onNon, grand = false }: { oui: boolean; non: boolean; onOui(): void; onNon(): void; grand?: boolean }) {
  return (
    <div className={`ct-oui-non ${grand ? 'grand' : ''}`}>
      <button type="button" className={`btn ct-oui ${oui ? 'choisi' : ''}`} aria-pressed={oui} onClick={onOui}>{t('kiavik.controle.oui')}</button>
      <button type="button" className={`btn ct-non ${non ? 'choisi' : ''}`} aria-pressed={non} onClick={onNon}>{t('kiavik.controle.non')}</button>
    </div>
  );
}

/** Après « Non » : l'astuce liée à l'étape (ou un simple message s'il n'y en a pas). */
export function AideNon({ e }: { e: Etape }) {
  const { liste } = useSolutions();
  const s = e.solutionId ? liste?.find((x) => x.id === e.solutionId) : undefined;
  return (
    <div className="ct-aide">
      <b>{t('kiavik.controle.titreAide')}</b>
      {s ? (
        <>
          <span className="ct-astuce">💡 {s.titre}</span>
          {s.cause && <span className="muted petit">{s.cause}</span>}
          <span>{s.texte}</span>
          {s.avertissement && <div className="gx-warn">⚠️ {s.avertissement}</div>}
          <Link to={`/solutions/${s.id}`} className="lien petit">{t('kiavik.controle.voirAstuce')}</Link>
        </>
      ) : (
        <span className="muted petit">{t('kiavik.controle.sansAstuce')}</span>
      )}
      <span className="muted petit">{t('kiavik.controle.ensuite')}</span>
    </div>
  );
}

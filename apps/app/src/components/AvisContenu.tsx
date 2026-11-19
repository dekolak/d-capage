import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { t } from '../lib/i18n';

/**
 * « Ce contenu était-il clair ? » en fin de pas-à-pas, de leçon ou de page (si l'admin l'a activé sur ce contenu).
 * 👍 envoie tout de suite ; 🤔 ouvre une case facultative. Un avis par client, modifiable.
 */
export function AvisContenu({ type, id }: { type: 'procedure' | 'lecon'; id: string }) {
  const [mien, setMien] = useState<{ clair: boolean; commentaire: string | null } | null>();
  const [flou, setFlou] = useState(false);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [modifier, setModifier] = useState(false);
  useEffect(() => {
    setMien(undefined);
    setModifier(false);
    setFlou(false);
    api<{ clair: boolean; commentaire: string | null } | null>(`/avis-contenu?type=${type}&id=${id}`).then((a) => setMien(a && typeof a.clair === 'boolean' ? a : null)).catch(() => setMien(null));
  }, [type, id]);
  const envoyer = async (clair: boolean) => {
    setEnvoi(true);
    try {
      setMien(await api('/avis-contenu', { method: 'PUT', json: { type, id, clair, commentaire: clair ? null : texte.trim() || null } }));
      setModifier(false);
      setFlou(false);
    } catch {
      /* réessayer plus tard */
    } finally {
      setEnvoi(false);
    }
  };
  if (mien === undefined) return null;
  if (mien && !modifier)
    return (
      <section className="avis-contenu carte fait">
        <span>{mien.clair ? t('avisContenu.merciClair') : t('avisContenu.merciFlou')}</span>
        <button type="button" className="btn-lien petit" onClick={() => ((setModifier(true), setTexte(mien.commentaire ?? ''), setFlou(!mien.clair)))}>{t('avisContenu.modifier')}</button>
      </section>
    );
  return (
    <section className="avis-contenu carte">
      <b>{t('avisContenu.question')}</b>
      <div className="avis-boutons">
        <button type="button" className="btn" disabled={envoi} onClick={() => envoyer(true)}>👍 {t('avisContenu.clair')}</button>
        <button type="button" className={`btn ${flou ? 'on' : ''}`} disabled={envoi} onClick={() => setFlou(true)}>🤔 {t('avisContenu.flou')}</button>
      </div>
      {flou && (
        <>
          <textarea rows={3} maxLength={2000} value={texte} placeholder={t('avisContenu.quoi')} onChange={(e) => setTexte(e.target.value)} />
          <button type="button" className="btn prim" disabled={envoi} onClick={() => envoyer(false)}>{t('avisContenu.envoyer')}</button>
        </>
      )}
    </section>
  );
}

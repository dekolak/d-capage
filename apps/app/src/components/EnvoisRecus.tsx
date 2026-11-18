import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONE_TYPE, TypePasAPas, useAccesProcedures } from '../espaces/kiavik/donneesProcedures';
import { api } from '../lib/api';
import { t } from '../lib/i18n';

export interface EnvoiRecu {
  id: string; machineId: string; auteur: string; message: string | null; creeLe: string; vu: boolean; ouvert: boolean; termine: boolean;
  pasAPas: { id: string; titre: string; type: TypePasAPas };
}

/** Ouvrir un pas-à-pas reçu : la fin du parcours le marque « terminé » (clé gardée sur le téléphone). */
export function ouvrirRecu(e: EnvoiRecu, nav: (to: string) => void) {
  for (const k of ['etapes', 'controles', 'reponses', 'envoye', 'envoyePlusTard', 'session', 'parcours']) {
    if (!e.ouvert) localStorage.removeItem(`kiavik.${k}.${e.pasAPas.id}`);
  }
  localStorage.setItem(`kiavik.envoi.${e.pasAPas.id}`, e.id);
  nav(`/procedures/${e.pasAPas.id}`);
}

/** Bulles « 📤 Teddy vous a envoyé : … » à l'ouverture de l'app (pas encore vues). */
export function EnvoisRecus() {
  const acces = useAccesProcedures();
  const [liste, setListe] = useState<EnvoiRecu[]>([]);
  const nav = useNavigate();
  const charger = useCallback(() => api<EnvoiRecu[]>('/procedures/envois/miens').then((l) => setListe(l.filter((e) => !e.vu))).catch(() => {}), []);
  useEffect(() => {
    if (!acces) return;
    charger();
    const f = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [acces, charger]);
  const vu = (e: EnvoiRecu) => {
    setListe((l) => l.filter((x) => x.id !== e.id));
    api(`/procedures/envois/${e.id}/vu`, { method: 'POST' }).catch(() => {});
  };
  if (!liste.length) return null;
  return (
    <div className="annonces">
      {liste.slice(0, 3).map((e) => (
        <div key={e.id} className="bulle-annonce info">
          <span className="ba-ic">{ICONE_TYPE[e.pasAPas.type] ?? '📋'}</span>
          <div className="ba-corps">
            <b>{t('envoi.titre', { auteur: e.auteur, titre: e.pasAPas.titre })}</b>
            {e.message && <p>« {e.message} »</p>}
            <div className="ba-actions">
              <button type="button" className="btn petit prim" onClick={() => { vu(e); ouvrirRecu(e, nav); }}>{t('envoi.ouvrir')}</button>
              <button type="button" className="btn petit" onClick={() => vu(e)}>{t('envoi.plusTard')}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

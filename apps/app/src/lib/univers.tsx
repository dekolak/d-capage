import { useMemo, useState } from 'react';
import { UNIVERS, universTechnologie } from '@decapage/machine-kit';
import type { GroupeTag, MaMachine } from './api';
import { t } from './i18n';

/**
 * Métiers Lazzeko (décapage, soudure) : donnés par les machines du client.
 * Un client qui a les deux passe de l'un à l'autre (choix gardé sur le téléphone).
 */
const CLE = 'lazzeko.univers';

export const universMachine = (m: { technologie: string | null }) => universTechnologie(m.technologie);

/** Groupes de tags proposés pour un métier (un groupe sans métier sert à tous). */
export const groupesDu = (groupes: GroupeTag[], univers?: string) =>
  univers ? groupes.filter((g) => !g.univers?.length || g.univers.includes(univers)) : groupes;

export function useUnivers(machines: MaMachine[] | undefined) {
  const liste = useMemo<string[]>(() => UNIVERS.filter((u) => machines?.some((m) => universMachine(m) === u)), [machines]);
  const [choix, setChoix] = useState(() => localStorage.getItem(CLE) ?? '');
  const univers = liste.includes(choix) ? choix : (liste[0] ?? 'decapage');
  const choisir = (u: string) => {
    localStorage.setItem(CLE, u);
    setChoix(u);
  };
  return { univers, liste, choisir, pret: machines !== undefined };
}

/** « Décapage | Soudure » : visible seulement si le client a les deux métiers. */
export function BasculeUnivers({ liste, univers, choisir }: { liste: string[]; univers: string; choisir: (u: string) => void }) {
  if (liste.length < 2) return null;
  return (
    <div className="seg bascule-univers" role="group" aria-label={t('univers.titre')}>
      {liste.map((u) => (
        <button key={u} type="button" className={u === univers ? 'on' : ''} onClick={() => choisir(u)}>{t(`univers.${u}` as Parameters<typeof t>[0])}</button>
      ))}
    </div>
  );
}

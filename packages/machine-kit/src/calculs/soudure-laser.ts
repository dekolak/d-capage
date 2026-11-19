import type { ChampChoix, ConfigMachine, Valeurs } from '../schema';
import type { Indicateur, Technologie } from './types';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v ?? d));
const MODE_POINT = 1;

/** Diamètre du fil choisi (option du champ « wire », donnée `d` en mm). */
function diametreFil(cfg: ConfigMachine, v: Valeurs): number | null {
  for (const p of cfg.pages)
    for (const s of p.sections)
      for (const c of s.champs)
        if (c.key === 'wire' && c.type === 'choix') {
          const o = (c as ChampChoix).options.find((x) => String(x.valeur) === String(v.wire));
          return o?.donnees?.d ?? null;
        }
  return null;
}

/**
 * Soudeuse laser continue (formules du simulateur Lazzeko).
 * Constantes : pmax (W, puissance nominale de la source) ; pref_cordon (W, référence de l'estimation du cordon).
 * Repère de réglage : largeur de balayage = 2 à 3,5 × le diamètre du fil.
 */
export function modeleSoudure(cfg: ConfigMachine, v: Valeurs) {
  const pmax = num(cfg.constantes.pmax);
  const sortie = (pmax * num(v.pk) * num(v.du, 100)) / 10000; // W
  const fil = v.won === true;
  const balayage = v.swing === true && num(v.mode) !== MODE_POINT;
  const largeur = balayage ? num(v.wd) : 0;
  const cordon = largeur + 0.4 + (0.6 * sortie) / num(cfg.constantes.pref_cordon, 3000) + (fil ? 0.3 : 0); // mm (estimation)
  const d = fil ? diametreFil(cfg, v) : null;
  const rapport = d && balayage ? largeur / d : null;
  const energieTir = num(v.mode) === MODE_POINT ? (sortie * num(v.pt)) / 1000 : null; // J
  return { sortie, cordon, fil, d, rapport, energieTir };
}

export const soudureLaser: Technologie = {
  id: 'soudure-laser',
  nom: 'Soudure laser',
  univers: 'soudure',
  // Menu nettoyage de la soudeuse (à venir) : ces fiches rejoignent le décapage.
  universFiche: (_cfg, v) => (v.procede === 'nettoyage' ? 'decapage' : 'soudure'),
  indicateurs(cfg, v): Indicateur[] {
    const m = modeleSoudure(cfg, v);
    const l: Indicateur[] = [
      { key: 'sortie', label: 'Puissance de sortie', valeur: +m.sortie.toFixed(0), unite: 'W', note: 'puissance × PwrPeak × PwmWid' },
    ];
    if (m.energieTir !== null) l.push({ key: 'tir', label: 'Énergie par tir', valeur: +m.energieTir.toFixed(1), unite: 'J', note: 'mode point' });
    l.push({ key: 'cordon', label: 'Largeur du cordon', valeur: +m.cordon.toFixed(1), unite: 'mm', hypothese: true, note: 'estimation' });
    if (m.rapport !== null) {
      const r = m.rapport;
      const note = r < 1 ? 'trop étroit : le faisceau ne couvre pas le fil' : r < 2 ? 'un peu étroit : cordon bombé' : r > 3.5 ? 'large : énergie étalée, moins de pénétration' : 'bon réglage (2 à 3,5 × le fil)';
      l.push({ key: 'rapportFil', label: 'Largeur / fil', valeur: +r.toFixed(1), unite: '× le fil', note });
    }
    return l;
  },
};

import { Champ, ConfigMachine, ConfigMachineSchema, Valeurs } from './schema';
import { technologie } from './calculs';

export interface Erreur {
  key?: string;
  message: string;
}

/** Valide et normalise un JSON de config (lève une erreur lisible si invalide). */
export function chargerConfig(json: unknown): ConfigMachine {
  const r = ConfigMachineSchema.safeParse(json);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`).join('\n');
    throw new Error(`Config machine invalide :\n${msg}`);
  }
  return r.data;
}

export function tousLesChamps(cfg: ConfigMachine): Champ[] {
  return cfg.pages.flatMap((p) => p.sections.flatMap((s) => s.champs));
}

export function champsEnregistres(cfg: ConfigMachine): Champ[] {
  return tousLesChamps(cfg).filter((c) => c.enregistre);
}

export function trouverChamp(cfg: ConfigMachine, key: string): Champ | undefined {
  return tousLesChamps(cfg).find((c) => c.key === key);
}

export function estVisible(champ: Champ, valeurs: Valeurs): boolean {
  if (!champ.visibleSi) return true;
  return Object.entries(champ.visibleSi).every(([k, liste]) => liste.includes(valeurs[k] as never));
}

export function valeursParDefaut(cfg: ConfigMachine): Valeurs {
  const v: Valeurs = {};
  for (const c of tousLesChamps(cfg)) v[c.key] = c.defaut;
  return v;
}

/** Valeurs par défaut + préréglage n° `no`. */
export function valeursPreset(cfg: ConfigMachine, no: number): Valeurs {
  const p = cfg.presets.find((x) => x.no === no);
  if (!p) throw new Error(`Préréglage ${no} introuvable`);
  return { ...valeursParDefaut(cfg), ...p.valeurs };
}

function arrondi(v: number, step: number, min: number): number {
  const n = Math.round((v - min) / step) * step + min;
  return +n.toFixed(6);
}

function validerChamp(c: Champ, brut: unknown): { valeur?: Valeurs[string]; erreur?: string } {
  switch (c.type) {
    case 'nombre': {
      const n = typeof brut === 'string' && brut.trim() !== '' ? Number(brut) : brut;
      if (typeof n !== 'number' || !Number.isFinite(n)) return { erreur: 'nombre attendu' };
      if (n < c.min || n > c.max) return { erreur: `doit être entre ${c.min} et ${c.max}` };
      return { valeur: arrondi(n, c.step, c.min) };
    }
    case 'interrupteur':
      if (typeof brut !== 'boolean') return { erreur: 'vrai/faux attendu' };
      return { valeur: brut };
    case 'choix': {
      const o = c.options.find((x) => x.valeur === brut || String(x.valeur) === String(brut));
      if (!o) return { erreur: 'option inconnue' };
      return { valeur: o.valeur };
    }
    case 'texte':
      if (typeof brut !== 'string') return { erreur: 'texte attendu' };
      if (brut.length > c.maxLength) return { erreur: `${c.maxLength} caractères max` };
      return { valeur: brut };
  }
}

/**
 * Valide les valeurs saisies pour une fiche.
 * Ne garde que les champs `enregistre` ET visibles (ex. Rayon int. ignoré si le motif n'est pas l'anneau).
 * Les champs absents prennent leur valeur par défaut.
 */
export function validerValeurs(
  cfg: ConfigMachine,
  saisie: Record<string, unknown>,
): { ok: boolean; valeurs: Valeurs; erreurs: Erreur[] } {
  const erreurs: Erreur[] = [];
  const complet: Valeurs = valeursParDefaut(cfg);
  const connus = new Set(tousLesChamps(cfg).map((c) => c.key));
  for (const k of Object.keys(saisie)) if (!connus.has(k)) erreurs.push({ key: k, message: 'champ inconnu' });

  for (const c of tousLesChamps(cfg)) {
    if (!(c.key in saisie)) continue;
    const r = validerChamp(c, saisie[c.key]);
    if (r.erreur) erreurs.push({ key: c.key, message: r.erreur });
    else complet[c.key] = r.valeur!;
  }

  const valeurs: Valeurs = {};
  for (const c of champsEnregistres(cfg)) if (estVisible(c, complet)) valeurs[c.key] = complet[c.key];

  const tech = technologie(cfg.technologie);
  if (tech?.valider && erreurs.length === 0) erreurs.push(...tech.valider(cfg, complet));

  return { ok: erreurs.length === 0, valeurs, erreurs };
}

/** Valeurs par défaut + valeurs connues de cette config (ignore les champs retirés d'une ancienne fiche). */
export function completer(cfg: ConfigMachine, valeurs: Record<string, unknown> | null | undefined): Valeurs {
  const v = valeursParDefaut(cfg);
  for (const k of Object.keys(v)) if (valeurs && k in valeurs) v[k] = valeurs[k] as Valeurs[string];
  return v;
}

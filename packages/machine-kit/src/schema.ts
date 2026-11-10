import { z } from 'zod';

/**
 * Schéma d'une config machine (« miroir » de l'interface).
 * Une config = une version d'interface d'une variante de machine.
 * Ajouter une machine = ajouter un JSON qui respecte ce schéma, sans toucher au code.
 */

/** Texte traduit : `fr` obligatoire, autres langues facultatives (en, es…). */
export const I18nSchema = z.object({ fr: z.string().min(1), en: z.string().optional() }).catchall(z.string());
export type I18n = z.infer<typeof I18nSchema>;

const Valeur = z.union([z.string(), z.number(), z.boolean()]);
export type Valeur = z.infer<typeof Valeur>;

/** Le champ est visible si, pour chaque clé, la valeur courante est dans la liste. */
export const ConditionSchema = z.record(z.string(), z.array(Valeur).min(1));
export type Condition = z.infer<typeof ConditionSchema>;

const ChampBase = {
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: I18nSchema,
  aide: I18nSchema.optional(),
  /** true = la valeur est enregistrée dans une fiche réglage. */
  enregistre: z.boolean().default(false),
  visibleSi: ConditionSchema.optional(),
  /** Colonne d'affichage dans une section à plusieurs colonnes (comme sur l'écran réel). */
  colonne: z.number().int().min(1).max(3).optional(),
};

export const ChampNombreSchema = z.object({
  ...ChampBase,
  type: z.literal('nombre'),
  unite: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  /** Échelle du curseur (log utile pour la fréquence). */
  echelle: z.enum(['lineaire', 'log']).default('lineaire'),
  defaut: z.number(),
});

export const ChampInterrupteurSchema = z.object({
  ...ChampBase,
  type: z.literal('interrupteur'),
  defaut: z.boolean(),
});

export const OptionSchema = z.object({
  valeur: z.union([z.string(), z.number()]),
  label: I18nSchema,
  /** SVG (contenu interne, viewBox 0 0 56 36) pour l'affichage en icônes. */
  icone: z.string().optional(),
  /** Données techniques libres utilisées par les calculs (ex. focale, zone max). */
  donnees: z.record(z.string(), z.number()).optional(),
});
export type Option = z.infer<typeof OptionSchema>;

export const ChampChoixSchema = z.object({
  ...ChampBase,
  type: z.literal('choix'),
  affichage: z.enum(['liste', 'icones']).default('liste'),
  options: z.array(OptionSchema).min(1),
  defaut: z.union([z.string(), z.number()]),
});

export const ChampTexteSchema = z.object({
  ...ChampBase,
  type: z.literal('texte'),
  maxLength: z.number().int().positive().default(32),
  defaut: z.string(),
});

export const ChampSchema = z.discriminatedUnion('type', [
  ChampNombreSchema,
  ChampInterrupteurSchema,
  ChampChoixSchema,
  ChampTexteSchema,
]);
export type Champ = z.infer<typeof ChampSchema>;
export type ChampNombre = z.infer<typeof ChampNombreSchema>;
export type ChampChoix = z.infer<typeof ChampChoixSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  label: I18nSchema.optional(),
  /** Indice de mise en page pour le miroir (zone de l'écran réel). */
  zone: z.string().optional(),
  colonnes: z.number().int().min(1).max(3).default(1),
  champs: z.array(ChampSchema),
});
export type Section = z.infer<typeof SectionSchema>;

export const PageSchema = z.object({
  id: z.string(),
  label: I18nSchema,
  sections: z.array(SectionSchema).min(1),
});
export type Page = z.infer<typeof PageSchema>;

export const PresetSchema = z.object({
  no: z.number().int(),
  label: I18nSchema,
  valeurs: z.record(z.string(), Valeur),
  /** Slugs de tags suggérés quand on part de ce préréglage. */
  tags: z.array(z.string()).default([]),
  /** true = valeurs d'exemple, à confirmer sur la machine. */
  exemple: z.boolean().default(false),
});
export type Preset = z.infer<typeof PresetSchema>;

const Ref = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), nom: z.string() });

export const ConfigMachineSchema = z
  .object({
    schemaVersion: z.literal(1),
    /** Clé du module de calcul (voir calculs/). */
    technologie: z.string(),
    fabricant: Ref,
    modele: Ref,
    variante: Ref,
    /** Version de l'interface machine (incrémenter si le menu change). */
    versionInterface: z.number().int().positive(),
    langues: z.array(z.string()).default(['fr']),
    theme: z.record(z.string(), z.string()).default({}),
    /** Constantes physiques (puissance max…). Les hypothèses sont signalées dans `hypotheses`. */
    constantes: z.record(z.string(), z.number()).default({}),
    hypotheses: z.array(z.string()).default([]),
    pages: z.array(PageSchema).min(1),
    presets: z.array(PresetSchema).default([]),
    /** Explications générales affichées dans le menu Aide de l'app. */
    guide: z.array(z.object({ titre: I18nSchema, texte: I18nSchema })).default([]),
    /** Lien vers l'aide complète (simulateur, exercices) sur le site. */
    lienAide: z.string().url().optional(),
  })
  .superRefine((cfg, ctx) => {
    const keys = new Map<string, Champ>();
    for (const p of cfg.pages)
      for (const s of p.sections)
        for (const c of s.champs) {
          if (keys.has(c.key)) ctx.addIssue({ code: 'custom', message: `Clé de champ en double : ${c.key}` });
          keys.set(c.key, c);
          if (c.type === 'nombre' && (c.min > c.max || c.defaut < c.min || c.defaut > c.max))
            ctx.addIssue({ code: 'custom', message: `Limites incohérentes pour ${c.key}` });
          if (c.type === 'choix' && !c.options.some((o) => o.valeur === c.defaut))
            ctx.addIssue({ code: 'custom', message: `Défaut absent des options pour ${c.key}` });
        }
    for (const c of keys.values())
      for (const k of Object.keys(c.visibleSi ?? {}))
        if (!keys.has(k)) ctx.addIssue({ code: 'custom', message: `visibleSi de ${c.key} référence ${k} inconnu` });
    for (const pr of cfg.presets)
      for (const k of Object.keys(pr.valeurs))
        if (!keys.has(k)) ctx.addIssue({ code: 'custom', message: `Préréglage ${pr.no} : champ ${k} inconnu` });
  });

export type ConfigMachine = z.infer<typeof ConfigMachineSchema>;
export type Valeurs = Record<string, Valeur>;

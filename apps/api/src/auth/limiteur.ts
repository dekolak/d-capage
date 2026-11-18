import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limite d'essais en mémoire (un seul serveur) : au plus `max` essais par clé sur `fenetreMin` minutes.
 * Sert contre les robots qui essaient des mots de passe ou envoient des demandes en boucle.
 * Les maximums se règlent par variables d'environnement (ex. LIMITE_CONNEXION_IP).
 */
export class Limiteur {
  private essais = new Map<string, number[]>();

  constructor(private max: number, private fenetreMin: number) {}

  private recents(cle: string, maintenant: number) {
    const l = (this.essais.get(cle) ?? []).filter((t) => t > maintenant - this.fenetreMin * 60_000);
    if (l.length) this.essais.set(cle, l);
    else this.essais.delete(cle);
    return l;
  }

  /** Erreur 429 si la clé a déjà atteint le maximum (sans compter cet essai). */
  verifier(cle: string) {
    const maintenant = Date.now();
    const l = this.recents(cle, maintenant);
    if (l.length >= this.max) {
      const minutes = Math.max(1, Math.ceil((l[0] + this.fenetreMin * 60_000 - maintenant) / 60_000));
      throw new HttpException(
        { message: `Trop d'essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, code: 'TROP_D_ESSAIS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // ménage de temps en temps (clés anciennes)
    if (this.essais.size > 10_000) for (const k of [...this.essais.keys()]) this.recents(k, maintenant);
  }

  compter(cle: string) {
    const l = this.recents(cle, Date.now());
    l.push(Date.now());
    this.essais.set(cle, l);
  }

  /** Vérifie puis compte l'essai. */
  essai(cle: string) {
    this.verifier(cle);
    this.compter(cle);
  }

  effacer(cle: string) {
    this.essais.delete(cle);
  }
}

const nombre = (nom: string, defaut: number) => {
  const n = Number(process.env[nom]);
  return Number.isFinite(n) && n > 0 ? n : defaut;
};

/** Connexion : tous les essais d'une adresse IP, et les échecs sur un même identifiant. */
export const LIMITE_CONNEXION_IP = new Limiteur(nombre('LIMITE_CONNEXION_IP', 30), 5);
export const LIMITE_ECHECS_IDENTIFIANT = new Limiteur(nombre('LIMITE_ECHECS_IDENTIFIANT', 10), 15);
/** Mot de passe oublié (demandes) et saisie du code, par adresse IP. */
export const LIMITE_DEMANDES_IP = new Limiteur(nombre('LIMITE_DEMANDES_IP', 5), 60);
export const LIMITE_CODE_IP = new Limiteur(nombre('LIMITE_CODE_IP', 20), 15);

/** Adresse IP du client (derrière le proxy de Coolify : `trust proxy` dans main.ts). */
export const ipDe = (req: { ip?: string; socket?: { remoteAddress?: string } }) => req.ip ?? req.socket?.remoteAddress ?? 'inconnue';

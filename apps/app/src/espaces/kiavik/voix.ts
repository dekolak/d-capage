import { useCallback, useEffect, useRef, useState } from 'react';
import { langue, t } from '../../lib/i18n';

/**
 * Voix off des animations (speechSynthesis) dans la langue de l'app. Règles de Teddy (français) :
 * voix « Google français » d'abord, puis Julie, puis Natural / Online / Neural (Denise, Henri), puis toute voix fr ;
 * dans une autre langue : voix Google, puis Natural / Online / Neural, puis toute voix de la langue ;
 * liste rechargée sur `voiceschanged` ; débit 0,6–1,6 selon la vitesse ×0,25–×2.
 */
const CLE_VOIX = 'kiavik.voix';
const CLE_ACTIVE = 'kiavik.voixOff';

function rang(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('google')) return 0;
  if (n.includes('julie')) return 1;
  if (/natural|online|neural/.test(n)) return /denise|henri/.test(n) ? 2 : 3;
  return 4;
}

export const debitVoix = (vitesse: number) => 0.6 + ((vitesse - 0.25) / 1.75) * 1.0;

/** Phrase orale : sans symboles (… « » → émojis), calculs lus en mots (90 − 4 = 86 → « 90 moins 4 égale 86 »). */
export const texteOral = (s: string) =>
  s
    .replace(/(\d)\s*[−-]\s*(\d)/g, `$1 ${t('kiavik.anim.oral.moins')} $2`)
    .replace(/(\d)\s*\+\s*(\d)/g, `$1 ${t('kiavik.anim.oral.plus')} $2`)
    .replace(/(\d)\s*=\s*(\d)/g, `$1 ${t('kiavik.anim.oral.egale')} $2`)
    .replace(/…/g, ' ')
    .replace(/[«»→👉📄💻🧱🎨⬜]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function useVoix() {
  const dispo = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voix, setVoix] = useState<SpeechSynthesisVoice[]>([]);
  const [nom, setNom] = useState(() => localStorage.getItem(CLE_VOIX) ?? '');
  const [active, setActive] = useState(() => localStorage.getItem(CLE_ACTIVE) !== '0'); // cochée par défaut
  const enCours = useRef<{ fin: () => void } | null>(null);

  useEffect(() => {
    if (!dispo) return;
    const charger = () => {
      const l = langue();
      const principale = l === 'fr' ? 'fr-FR' : l === 'en' ? 'en-GB' : '';
      const liste = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(l));
      liste.sort((a, b) => rang(a) - rang(b) || Number(b.lang === principale) - Number(a.lang === principale));
      setVoix(liste);
    };
    charger();
    speechSynthesis.addEventListener('voiceschanged', charger);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', charger);
      speechSynthesis.cancel();
    };
  }, [dispo]);

  const choisie = voix.find((v) => v.name === nom) ?? voix[0];

  const choisir = (n: string) => {
    setNom(n);
    localStorage.setItem(CLE_VOIX, n);
  };
  const activer = (b: boolean) => {
    setActive(b);
    localStorage.setItem(CLE_ACTIVE, b ? '1' : '0');
    if (!b && dispo) speechSynthesis.cancel();
  };

  const arreter = useCallback(() => {
    enCours.current = null;
    if (dispo) speechSynthesis.cancel();
  }, [dispo]);

  /**
   * Lit une phrase. La promesse se termine à la fin de la lecture, ou après une durée estimée (sécurité),
   * ou tout de suite si la voix est coupée.
   */
  const dire = useCallback(
    (texte: string, vitesse: number): Promise<void> =>
      new Promise((ok) => {
        if (!dispo || !active || !choisie || !texte) return ok();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texteOral(texte));
        u.voice = choisie;
        u.lang = choisie.lang;
        u.rate = debitVoix(vitesse);
        let fini = false;
        const fin = () => {
          if (fini) return;
          fini = true;
          clearTimeout(secu);
          ok();
        };
        const mots = u.text.split(' ').length;
        const secu = setTimeout(fin, (mots * 420) / u.rate + 1500); // reprise de sécurité
        u.onend = fin;
        u.onerror = fin;
        enCours.current = { fin };
        speechSynthesis.speak(u);
      }),
    [dispo, active, choisie],
  );

  return { dispo, voix, choisie, choisir, active, activer, dire, arreter, sansVoix: dispo && voix.length === 0 };
}

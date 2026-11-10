import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voix off des animations (speechSynthesis, fr-FR), règles de Teddy :
 * voix « Google français » d'abord, puis Julie, puis Natural / Online / Neural (Denise, Henri), puis toute voix fr ;
 * liste rechargée sur `voiceschanged` ; débit 0,6–1,6 selon la vitesse ×0,25–×2.
 */
const CLE_VOIX = 'kiavik.voix';
const CLE_ACTIVE = 'kiavik.voixOff';

function rang(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('google') && n.includes('fran')) return 0;
  if (n.includes('julie')) return 1;
  if (/natural|online|neural/.test(n)) return /denise|henri/.test(n) ? 2 : 3;
  return 4;
}

export const debitVoix = (vitesse: number) => 0.6 + ((vitesse - 0.25) / 1.75) * 1.0;

/** Phrase orale : sans symboles (… « » → émojis). */
export const texteOral = (s: string) =>
  s
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
      const fr = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('fr'));
      fr.sort((a, b) => rang(a) - rang(b) || Number(b.lang === 'fr-FR') - Number(a.lang === 'fr-FR'));
      setVoix(fr);
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

  return { dispo, voix, choisie, choisir, active, activer, dire, arreter, sansVoixFr: dispo && voix.length === 0 };
}

import { api } from './api';

/** Notifications sur le téléphone de l'admin (Web Push, via le service worker de l'app). */
const base64EnOctets = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export const notificationsPossibles = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function enregistrement(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, ko) => setTimeout(() => ko(new Error('Application pas encore installée sur ce téléphone : rechargez la page puis réessayez.')), 5000)),
  ]);
  return reg;
}

/** Abonnement actuel de ce téléphone (null si aucun). */
export async function abonnementActuel(): Promise<PushSubscription | null> {
  if (!notificationsPossibles()) return null;
  try {
    return await (await enregistrement()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function activerNotifications() {
  if (!notificationsPossibles())
    throw new Error("Ce navigateur ne permet pas les notifications. Sur iPhone : ajoutez d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-la depuis l'icône.");
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du téléphone pour cette app.');
  const reg = await enregistrement();
  const { cle } = await api<{ cle: string }>('/push/cle');
  const abo = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64EnOctets(cle) }));
  await api('/push/abonnement', { method: 'POST', json: abo.toJSON() });
  return api<{ telephones: number }>('/push/test', { method: 'POST' });
}

export async function desactiverNotifications() {
  const abo = await abonnementActuel();
  if (!abo) return;
  await api('/push/abonnement', { method: 'DELETE', json: { endpoint: abo.endpoint } }).catch(() => {});
  await abo.unsubscribe();
}

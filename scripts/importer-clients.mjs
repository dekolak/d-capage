#!/usr/bin/env node
/**
 * Import ponctuel de clients (ex. liste extraite d'Odoo) : crée les comptes et leurs machines par l'API,
 * avec un code provisoire unique par client (il choisit son mot de passe à la première connexion),
 * puis écrit un CSV pour n8n (envoi des emails).
 *
 *   CLE_API=dk_xxx node scripts/importer-clients.mjs clients.csv --api https://app.kiavikcopilot.ovh --essai
 *   CLE_API=dk_xxx node scripts/importer-clients.mjs clients.csv --api https://app.kiavikcopilot.ovh
 *
 * Voir docs/IMPORT-CLIENTS.md (colonnes du CSV, options, ce que reçoit n8n).
 * Node 18+ ; aucune dépendance.
 */
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

// ---------- options ----------
const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : defaut;
};
const fichier = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const API = (opt('api', process.env.API_URL ?? 'http://localhost:3000')).replace(/\/$/, '');
const ESPACE = opt('espace', 'kiavik');
const ESSAI = args.includes('--essai');
const SORTIE = opt('sortie', `clients-codes-${new Date().toISOString().slice(0, 10)}.csv`);
const CLE = process.env.CLE_API;
if (!fichier || !CLE) {
  console.error('Usage : CLE_API=dk_… node scripts/importer-clients.mjs clients.csv --api https://… [--espace kiavik] [--modules a,b] [--essai] [--sortie codes.csv]');
  process.exit(1);
}

// ---------- CSV ----------
/** Lit un CSV (séparateur ; ou , détecté, guillemets acceptés, BOM d'Excel retiré). */
function lireCsv(texte) {
  texte = texte.replace(/^﻿/, '');
  const sep = (texte.split('\n')[0].match(/;/g) ?? []).length >= (texte.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
  const lignes = [];
  let champ = '', ligne = [], guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') (champ += '"'), i++;
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) ligne.push(champ), (champ = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ), lignes.push(ligne), (ligne = []), (champ = '');
    } else champ += c;
  }
  if (champ || ligne.length) ligne.push(champ), lignes.push(ligne);
  const [entete, ...reste] = lignes.filter((l) => l.some((x) => x.trim()));
  const cles = entete.map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return reste.map((l, n) => ({ _ligne: n + 2, ...Object.fromEntries(cles.map((k, i) => [k, (l[i] ?? '').trim()])) }));
}
const csvEchap = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// ---------- utilitaires ----------
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** Code provisoire facile à dicter : 8 caractères sans 0/O, 1/I/L (ex. K7PM-42QX). */
function code() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const c = Array.from({ length: 8 }, () => A[randomInt(A.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
/** 31/12/2024, 2024-12-31 → ISO ; vide → null ; sinon erreur. */
function date(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) ?? null;
  const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
  const d = new Date(`${iso}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(d.getTime())) throw new Error(`date invalide « ${s} » (JJ/MM/AAAA)`);
  return d.toISOString();
}
async function api(methode, chemin, corps) {
  const r = await fetch(`${API}/api${chemin}`, {
    method: methode,
    headers: { 'X-Api-Key': CLE, 'Content-Type': 'application/json', 'X-Espace': ESPACE },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(Array.isArray(json.message) ? json.message.join(', ') : json.message ?? `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return json;
}

// ---------- préparation ----------
const lignes = lireCsv(readFileSync(fichier, 'utf8'));
const espaces = await api('GET', '/espaces');
const esp = espaces.find((e) => e.slug === ESPACE);
if (!esp) throw new Error(`Espace inconnu : ${ESPACE}`);
const modules = opt('modules')?.split(',').map((m) => m.trim()) ?? esp.modules.map((m) => m.slug);
const catalogue = await api('GET', '/admin/catalogue');
const modeles = catalogue.flatMap((f) => f.modeles.filter((m) => m.espaces.includes(ESPACE)).map((m) => ({ ...m, complet: `${f.nom} ${m.nom}` })));
console.log(`API ${API} · espace ${ESPACE} · modules ${modules.join(', ')}`);
console.log(`Modèles ${ESPACE} : ${modeles.map((m) => m.complet).join(', ') || '(aucun)'}\n`);

/** Modèle du CSV → modèle du catalogue (nom exact, sinon le seul qui contient le texte). */
function trouverModele(txt) {
  if (!txt) return null;
  const n = norm(txt);
  const exacts = modeles.filter((m) => norm(m.nom) === n || norm(m.complet) === n);
  const l = exacts.length ? exacts : modeles.filter((m) => norm(m.complet).includes(n));
  if (l.length !== 1) throw new Error(l.length ? `modèle « ${txt} » ambigu (${l.map((m) => m.complet).join(', ')})` : `modèle « ${txt} » introuvable`);
  if (!l[0].variantes?.length) throw new Error(`modèle « ${txt} » sans variante`);
  return l[0];
}

// regroupement par client (plusieurs lignes = plusieurs machines)
const clients = new Map();
const erreurs = [];
for (const l of lignes) {
  try {
    const identifiant = (l.identifiant || l.email || '').toLowerCase().trim();
    if (!/^[a-z0-9._@-]{3,64}$/.test(identifiant)) throw new Error(`identifiant invalide « ${identifiant} » (ou email manquant)`);
    const c = clients.get(identifiant) ?? { identifiant, nom: l.nom || '', email: l.email || '', numeroOdoo: l.numero_odoo || l.odoo || '', machines: [], lignes: [] };
    c.lignes.push(l._ligne);
    const modele = trouverModele(l.modele);
    if (modele) c.machines.push({ modele, numeroSerie: l.numero_serie || l.serie || null, miseEnService: date(l.mise_en_service) });
    clients.set(identifiant, c);
  } catch (e) {
    erreurs.push(`ligne ${l._ligne} : ${e.message}`);
  }
}
console.log(`${lignes.length} ligne(s) → ${clients.size} client(s), ${[...clients.values()].reduce((n, c) => n + c.machines.length, 0)} machine(s)`);
if (erreurs.length) {
  console.log(`\n❌ ${erreurs.length} erreur(s), rien n'est créé :\n  ${erreurs.join('\n  ')}`);
  process.exit(1);
}
if (ESSAI) {
  for (const c of clients.values()) console.log(`  ✓ ${c.identifiant} · ${c.nom || '—'} · ${c.machines.map((m) => `${m.modele.complet}${m.numeroSerie ? ` (${m.numeroSerie})` : ''}`).join(', ') || 'sans machine'}`);
  console.log('\nEssai seulement (--essai) : rien n\'a été créé. Relancez sans --essai pour importer.');
  process.exit(0);
}

// ---------- création ----------
const sortie = [['identifiant', 'nom', 'email', 'numero_client', 'code_provisoire', 'lien', 'resultat']];
let crees = 0;
for (const c of clients.values()) {
  const motDePasse = code();
  try {
    const u = await api('POST', '/users', {
      identifiant: c.identifiant, motDePasse, motDePasseProvisoire: true, modules,
      ...(c.nom ? { nom: c.nom } : {}), ...(c.numeroOdoo ? { numeroOdoo: c.numeroOdoo } : {}),
    });
    for (const m of c.machines)
      await api('POST', `/users/${u.id}/machines`, {
        varianteId: m.modele.variantes[0].id,
        ...(m.numeroSerie ? { numeroSerie: m.numeroSerie } : {}),
        ...(m.miseEnService ? { miseEnService: m.miseEnService } : {}),
      });
    crees++;
    sortie.push([c.identifiant, c.nom, c.email, u.numero ?? '', motDePasse, `${API}/?identifiant=${encodeURIComponent(c.identifiant)}`, 'cree']);
    console.log(`  ✅ ${c.identifiant} (n° ${u.numero}) · ${c.machines.length} machine(s)`);
  } catch (e) {
    const r = e.status === 409 ? 'existe_deja' : `erreur: ${e.message}`;
    sortie.push([c.identifiant, c.nom, c.email, '', '', '', r]);
    console.log(`  ${e.status === 409 ? '⏭' : '❌'} ${c.identifiant} : ${e.status === 409 ? 'existe déjà (rien changé)' : e.message}`);
  }
}
writeFileSync(SORTIE, '﻿' + sortie.map((l) => l.map(csvEchap).join(';')).join('\n') + '\n');
console.log(`\n${crees} compte(s) créé(s). Codes pour n8n : ${SORTIE}`);
console.log('⚠️  Ce fichier contient les codes provisoires : supprimez-le une fois les emails envoyés.');

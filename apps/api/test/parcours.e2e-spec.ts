/**
 * Parcours complet sur une vraie base (DATABASE_URL de .env, seed déjà lancé) :
 * comptes, machines, fiche, validation, photos, communauté, notes, duplication.
 */
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AppModule } from '../src/app.module';

// Plus petit JPEG valide (1×1)
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

describe('Parcours complet', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const id = Date.now().toString(36);
  let admin: string, alice: string, bob: string;
  let varianteId: string, machineAlice: string, machineBob: string, fiche: string, tagAcier: string, tagRouille: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());

    admin = (await http.post('/api/auth/connexion').send({ identifiant: process.env.ADMIN_IDENTIFIANT, motDePasse: process.env.ADMIN_PASSWORD })).body.jeton;
    expect(admin).toBeTruthy();
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'test' })).body.cle;
    for (const n of ['alice', 'bob'])
      expect((await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `${n}-${id}`, motDePasse: 'motdepasse1', nom: n })).status).toBe(201);
    alice = (await http.post('/api/auth/connexion').send({ identifiant: `alice-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    bob = (await http.post('/api/auth/connexion').send({ identifiant: `bob-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    // tant que les conditions ne sont pas acceptées, tout est bloqué
    const bloque = await http.get('/api/catalogue').set(auth(alice));
    expect(bloque.status).toBe(403);
    expect(bloque.body.code).toBe('CONDITIONS_A_ACCEPTER');
    for (const t of [alice, bob]) await accepter(t);
  });

  /** Accepte les conditions en vigueur (partage communautaire). */
  async function accepter(t: string, accordPhotosMarketing?: boolean) {
    const { version } = (await http.get('/api/conditions').set(auth(t))).body;
    await http.post('/api/moi/conditions').set(auth(t)).send({ version, accordPhotosMarketing }).expect(201);
  }

  afterAll(() => app.close());

  it('catalogue et machines', async () => {
    const cat = (await http.get('/api/catalogue').set(auth(alice))).body;
    varianteId = cat.find((f: any) => f.slug === 'lazzeko').modeles[0].variantes[0].id;
    const v = (await http.get(`/api/catalogue/versions/${cat[0].modeles[0].variantes[0].version.id}`).set(auth(alice))).body;
    expect(v.config.constantes.pmax).toBe(300);

    // l'utilisateur ajoute sa machine, l'admin attribue celle de Bob
    machineAlice = (await http.post('/api/moi/machines').set(auth(alice)).send({ varianteId })).body.id;
    expect((await http.post('/api/moi/machines').set(auth(alice)).send({ varianteId })).status).toBe(409);
    const bobId = (await http.get('/api/moi').set(auth(bob))).body.id;
    machineBob = (await http.post(`/api/users/${bobId}/machines`).set(auth(admin)).send({ varianteId, surnom: 'Atelier' })).body.id;
    const mes = (await http.get('/api/moi/machines').set(auth(bob))).body;
    expect(mes[0]).toMatchObject({ surnom: 'Atelier', nom: 'Lazzeko Nettoyeur laser pulsé 300 W' });
  });

  it('crée une fiche et refuse des réglages invalides', async () => {
    const groupes = (await http.get('/api/tags').set(auth(alice))).body;
    tagAcier = groupes.find((g: any) => g.slug === 'materiau').tags.find((t: any) => t.slug === 'acier').id;
    tagRouille = groupes.find((g: any) => g.slug === 'a-enlever').tags.find((t: any) => t.slug === 'rouille').id;

    const ko = await http.post('/api/fiches').set(auth(alice)).send({ userMachineId: machineAlice, titre: 'x', valeurs: { pwr: 150 } });
    expect(ko.status).toBe(400);
    expect(ko.body.erreurs[0].key).toBe('pwr');

    const r = await http.post('/api/fiches').set(auth(alice)).send({
      userMachineId: machineAlice,
      titre: 'Rouille sur acier',
      valeurs: { pwr: 85, freq: 20, pw: 500, scan: 2, oR: 10, iR: 2, speed: 20, lens: '254' },
      tagIds: [tagAcier, tagRouille],
      note: 4, // partagée par défaut
    });
    expect(r.status).toBe(201);
    fiche = r.body.id;
    expect(r.body.valeurs).toHaveProperty('iR', 2);
    expect(r.body.valeurs).not.toHaveProperty('len'); // invisible pour l'anneau
    expect(r.body.indicateurs.find((i: any) => i.key === 'energie').valeur).toBe(12.75);
    expect(r.body.note).toMatchObject({ moyenne: 4, nombre: 1, maNote: 4 });
  });

  it('photos', async () => {
    const p = await http.post(`/api/fiches/${fiche}/photos`).set(auth(alice)).field('type', 'AVANT').attach('fichier', JPEG, 'a.jpg');
    expect(p.status).toBe(201);
    const faux = await http.post(`/api/fiches/${fiche}/photos`).set(auth(alice)).field('type', 'APRES').attach('fichier', Buffer.from('pas une image'), 'a.jpg');
    expect(faux.status).toBe(400);
    expect((await http.post(`/api/fiches/${fiche}/photos`).set(auth(bob)).field('type', 'AVANT').attach('fichier', JPEG, 'a.jpg')).status).toBe(403);
    const img = await http.get(`/api/photos/${p.body.id}`).set(auth(bob)); // fiche partagée
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
  });

  it('communauté, note des autres, duplication', async () => {
    const c = (await http.get(`/api/communaute?varianteId=${varianteId}&tags=${tagAcier},${tagRouille}`).set(auth(bob))).body;
    expect(c.fiches.some((f: any) => f.id === fiche)).toBe(true);

    await http.post(`/api/fiches/${fiche}/evaluation`).set(auth(bob)).send({ note: 2, avis: 'un peu fort pour moi' }).expect(201);
    // moyenne 3 (4 + 2) : exclue du filtre « 4 étoiles et plus », présente sans filtre
    const top = (await http.get(`/api/communaute?varianteId=${varianteId}&noteMin=4&parPage=50`).set(auth(bob))).body;
    expect(top.fiches.some((f: any) => f.id === fiche)).toBe(false);
    expect(top.fiches.every((f: any) => f.note.moyenne >= 4)).toBe(true);
    const d = (await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body;
    expect(d.note).toMatchObject({ moyenne: 3, nombre: 2, maNote: 2 });
    expect(d.evaluations).toHaveLength(2);

    const copie = await http.post('/api/fiches').set(auth(bob)).send({ userMachineId: machineBob, titre: 'Ma version', valeurs: { ...d.valeurs, pwr: 70 }, parentId: fiche, visibilite: 'PRIVEE' });
    expect(copie.status).toBe(201);
    expect(copie.body.parent.id).toBe(fiche);

    // Bob ne peut pas modifier la fiche d'Alice ; une fiche privée est invisible pour les autres
    expect((await http.patch(`/api/fiches/${fiche}`).set(auth(bob)).send({ titre: 'pirate' })).status).toBe(403);
    expect((await http.get(`/api/fiches/${copie.body.id}`).set(auth(alice))).status).toBe(404);
  });

  it('admin : voit qui a fait la fiche et peut la masquer', async () => {
    const liste = (await http.get('/api/admin/fiches?parPage=50').set(auth(admin))).body;
    const f = liste.fiches.find((x: any) => x.id === fiche);
    expect(f.auteurAdmin.identifiant).toBe(`alice-${id}`);
    expect((await http.get('/api/admin/fiches').set(auth(bob))).status).toBe(403);
    // l'auteur réel n'est pas exposé aux non-admins
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body.auteurAdmin).toBeUndefined();

    await http.patch(`/api/admin/fiches/${fiche}`).set(auth(admin)).send({ masquee: true }).expect(200);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).status).toBe(404);
    const c = (await http.get(`/api/communaute?varianteId=${varianteId}&parPage=50`).set(auth(bob))).body;
    expect(c.fiches.some((x: any) => x.id === fiche)).toBe(false);
    const vueAuteur = (await http.get(`/api/fiches/${fiche}`).set(auth(alice))).body;
    expect(vueAuteur.masquee).toBe(true);
    expect((await http.patch(`/api/admin/fiches/${fiche}`).set(auth(bob)).send({ masquee: false })).status).toBe(403);

    await http.patch(`/api/admin/fiches/${fiche}`).set(auth(admin)).send({ masquee: false }).expect(200);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).status).toBe(200);
  });

  it('avis : modération par l\'admin ou par une clé API, et envoi des webhooks', async () => {
    // Récepteur local qui joue le rôle du service de modération externe.
    const recus: { corps: any; signature: string }[] = [];
    const srv: Server = createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c)).on('end', () => {
        recus.push({ corps: JSON.parse(b), signature: String(req.headers['x-decapage-signature']) });
        res.end('ok');
      });
    });
    await new Promise<void>((ok) => srv.listen(0, ok));
    const port = (srv.address() as any).port;
    const wh = (await http.post('/api/admin/webhooks').set(auth(admin)).send({ nom: 'IA', url: `http://127.0.0.1:${port}/`, evenements: ['avis.publie', 'avis.modifie', 'fiche.creee'] })).body;
    expect(wh.secret).toMatch(/^whsec_/);

    // un nouvel avis → envoyé, signé
    const carol = `carol-${id}`;
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'ia' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: carol, motDePasse: 'motdepasse1' }).expect(201);
    const tc = (await http.post('/api/auth/connexion').send({ identifiant: carol, motDePasse: 'motdepasse1' })).body.jeton;
    await accepter(tc);
    await http.post(`/api/fiches/${fiche}/evaluation`).set(auth(tc)).send({ note: 1, avis: 'Avis pas top du tout' }).expect(201);
    for (let i = 0; i < 40 && !recus.some((r) => r.corps.evenement === 'avis.publie'); i++) await new Promise((r) => setTimeout(r, 100));
    const env = recus.find((r) => r.corps.evenement === 'avis.publie')!;
    expect(env.corps.avis.texte).toBe('Avis pas top du tout');
    const attendu = 'sha256=' + createHmac('sha256', wh.secret).update(JSON.stringify(env.corps)).digest('hex');
    expect(env.signature).toBe(attendu);
    const avisId = env.corps.avis.id;

    const avant = (await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body;
    expect(avant.evaluations.some((e: any) => e.id === avisId)).toBe(true);

    // la « IA » masque l'avis via la clé API
    await http.patch(`/api/admin/avis/${avisId}`).set('X-Api-Key', cle).send({ statut: 'MASQUE', raison: 'hors sujet' }).expect(200);
    const apres = (await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body;
    expect(apres.evaluations.some((e: any) => e.id === avisId)).toBe(false);
    expect(apres.note.nombre).toBe(avant.note.nombre - 1); // exclu de la moyenne
    // l'auteur de l'avis le voit encore, avec son statut
    const pourCarol = (await http.get(`/api/fiches/${fiche}`).set(auth(tc))).body.evaluations.find((e: any) => e.estMoi);
    expect(pourCarol).toMatchObject({ statut: 'MASQUE', moderationRaison: 'hors sujet' });
    // le modifier ne le fait pas réapparaître
    await http.post(`/api/fiches/${fiche}/evaluation`).set(auth(tc)).send({ note: 2, avis: 'Je corrige' }).expect(201);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body.evaluations.some((e: any) => e.id === avisId)).toBe(false);

    // liste admin + réaffichage par l'admin ; un utilisateur ne peut pas modérer
    const liste = (await http.get('/api/admin/avis?statut=MASQUE').set(auth(admin))).body;
    expect(liste.avis.find((a: any) => a.id === avisId)).toMatchObject({ moderePar: 'auto' });
    expect((await http.patch(`/api/admin/avis/${avisId}`).set(auth(bob)).send({ statut: 'VISIBLE' })).status).toBe(403);
    await http.patch(`/api/admin/avis/${avisId}`).set(auth(admin)).send({ statut: 'VISIBLE' }).expect(200);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body.evaluations.some((e: any) => e.id === avisId)).toBe(true);

    // journal des envois
    const liv = (await http.get(`/api/admin/webhooks/${wh.id}/livraisons`).set(auth(admin))).body;
    expect(liv.some((l: any) => l.statut === 'ENVOYE')).toBe(true);
    await http.delete(`/api/admin/webhooks/${wh.id}`).set(auth(admin)).expect(200);
    srv.close();
  });

  it('miniature machine, accord photos, top réglages, demande d\'aide masquée', async () => {
    // --- miniature : l'admin envoie un PNG, tout le monde voit l'image ---
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const cat0 = (await http.get('/api/catalogue').set(auth(alice))).body;
    const modele = cat0.find((f: any) => f.slug === 'lazzeko').modeles[0];
    expect((await http.post(`/api/catalogue/modeles/${modele.id}/image`).set(auth(bob)).attach('image', PNG, 'm.png')).status).toBe(403);
    expect((await http.post(`/api/catalogue/modeles/${modele.id}/image`).set(auth(admin)).attach('image', Buffer.from('pas une image'), 'm.png')).status).toBe(400);
    await http.post(`/api/catalogue/modeles/${modele.id}/image`).set(auth(admin)).attach('image', PNG, 'm.png').expect(201);
    const cat = (await http.get('/api/catalogue').set(auth(alice))).body;
    const url = cat.find((f: any) => f.slug === 'lazzeko').modeles[0].variantes[0].imageUrl;
    expect(url).toMatch(/^\/api\/catalogue\/modeles\/.+\/image\?v=\d+$/);
    const img = await http.get(url); // publique, sans jeton
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect((await http.get('/api/moi/machines').set(auth(alice))).body[0].imageUrl).toBe(url);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(alice))).body.machine.imageUrl).toBe(url);

    // --- accord photos (dans le compte) : filtre admin « photos utilisables » ---
    const sans = (await http.get('/api/admin/fiches?photosUtilisables=oui&parPage=50').set(auth(admin))).body;
    expect(sans.fiches.some((x: any) => x.id === fiche)).toBe(false);
    expect((await http.patch('/api/moi/preferences').set(auth(alice)).send({ accordPhotosMarketing: true })).body.accordPhotosMarketing).toBe(true);
    const avec = (await http.get('/api/admin/fiches?photosUtilisables=oui&parPage=50').set(auth(admin))).body;
    expect(avec.fiches.find((x: any) => x.id === fiche).auteurAdmin.accordPhotosMarketing).toBe(true);
    expect((await http.get(`/api/fiches/${fiche}`).set(auth(bob))).body.auteurAdmin).toBeUndefined();

    // --- top réglages : la fiche notée apparaît sous ses tags ---
    // tag propre à ce test (la base de dev contient d'autres fiches « Acier »)
    const groupes = (await http.get('/api/tags').set(auth(alice))).body;
    const tagTest = (await http.post('/api/tags').set(auth(alice)).send({ groupeId: groupes.find((g: any) => g.slug === 'materiau').id, nom: `Test ${id}` })).body;
    await http.patch(`/api/fiches/${fiche}`).set(auth(alice)).send({ tagIds: [tagAcier, tagRouille, tagTest.id] }).expect(200);
    const top = (await http.get(`/api/top?varianteId=${varianteId}`).set(auth(bob))).body;
    const mat = top.find((g: any) => g.slug === 'materiau');
    expect(mat.tags.find((t: any) => t.id === tagTest.id).fiches.map((x: any) => x.id)).toEqual([fiche]);
    const acier = mat.tags.find((t: any) => t.id === tagAcier);
    expect(acier.fiches.length).toBeLessThanOrEqual(3);
    const notes = acier.fiches.map((x: any) => x.note.moyenne);
    expect([...notes].sort((x: number, y: number) => y - x)).toEqual(notes); // du mieux noté au moins bien noté

    // --- demande d'aide : désactivée par défaut, puis activée par l'admin ---
    expect((await http.get('/api/parametres').set(auth(bob))).body.aideSupport).toBe(false);
    expect((await http.post(`/api/fiches/${fiche}/aide`).set(auth(alice)).send({ message: 'Ça noircit la pièce' })).status).toBe(403);
    expect((await http.patch('/api/admin/parametres').set(auth(bob)).send({ aideSupport: true })).status).toBe(403);
    await http.patch('/api/admin/parametres').set(auth(admin)).send({ aideSupport: true }).expect(200);
    await http.post(`/api/fiches/${fiche}/aide`).set(auth(alice)).send({ message: 'Ça noircit la pièce' }).expect(201);
    const demandes = (await http.get('/api/admin/aide?traitee=non').set(auth(admin))).body;
    const d = demandes.find((x: any) => x.message === 'Ça noircit la pièce');
    expect(d.fiche.id).toBe(fiche);
    await http.patch(`/api/admin/aide/${d.id}`).set(auth(admin)).send({ traitee: true }).expect(200);
    await http.patch('/api/admin/parametres').set(auth(admin)).send({ aideSupport: false }).expect(200);
    await http.delete(`/api/catalogue/modeles/${modele.id}/image`).set(auth(admin)).expect(200);
  });

  it('conditions : une nouvelle version doit être acceptée de nouveau', async () => {
    const avant = (await http.get('/api/conditions').set(auth(alice))).body;
    expect((await http.post('/api/admin/conditions').set(auth(bob)).send({ texte: 'x'.repeat(30) })).status).toBe(403);
    const pub = (await http.post('/api/admin/conditions').set(auth(admin)).send({ texte: avant.texte })).body;
    expect(pub.version).toBe(avant.version + 1);
    // alice est bloquée jusqu'à acceptation ; /moi l'indique
    expect((await http.get('/api/moi').set(auth(alice))).body.conditionsAJour).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect((await http.post('/api/moi/conditions').set(auth(alice)).send({ version: avant.version })).status).toBe(409);
    await accepter(alice, false);
    const m = (await http.get('/api/moi').set(auth(alice))).body;
    expect(m).toMatchObject({ conditionsAJour: true, accordPhotosMarketing: false, modules: ['reglages-decapage'], espaces: [{ slug: 'lazzeko', conditionsAJour: true }] });
    expect(m.conditions.lazzeko.version).toBe(pub.version);
    // l'admin n'est jamais bloqué
    expect((await http.get('/api/catalogue').set(auth(admin))).status).toBe(200);
  });

  it('messages : ciblage, « J\'ai compris », retour périodique', async () => {
    const vus = async (t: string) => (await http.get('/api/annonces').set(auth(t))).body.map((a: any) => a.titre);
    const T = `Pensez à nettoyer la lentille ${id}`;
    await accepter(bob); // le test précédent a publié une nouvelle version des conditions
    // bob devient « autre marque » ; alice reste cliente Lazzeko (défaut)
    const bobId = (await http.get('/api/moi').set(auth(bob))).body.id;
    expect((await http.patch(`/api/users/${bobId}`).set(auth(admin)).send({ clientLazzeko: false })).body.clientLazzeko).toBe(false);

    // ciblage clients Lazzeko + variante : aperçu du nombre puis création
    const n = (await http.post('/api/admin/annonces/cible').set(auth(admin)).send({ cibleClient: 'LAZZEKO', varianteIds: [varianteId] })).body.utilisateurs;
    expect(n).toBeGreaterThan(0);
    expect((await http.post('/api/admin/annonces').set(auth(bob)).send({ titre: 'x', texte: 'yy' })).status).toBe(403);
    const a = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: T, texte: 'Chaque mois, un coup de chiffon.', niveau: 'CONSEIL', cibleClient: 'LAZZEKO', varianteIds: [varianteId], recurrence: 'JOURS', intervalle: 1, debut: new Date(Date.now() - 1.5 * 86400000) })).body;
    expect(await vus(alice)).toContain(T);
    expect(await vus(bob)).not.toContain(T); // pas client Lazzeko

    // « J'ai compris » : disparaît pour cette période
    await http.post(`/api/annonces/${a.id}/compris`).set(auth(alice)).expect(201);
    expect(await vus(alice)).not.toContain(T);
    // période suivante (on recule le début d'un jour) : il revient
    await http.patch(`/api/admin/annonces/${a.id}`).set(auth(admin)).send({ debut: new Date(Date.now() - 2.5 * 86400000) }).expect(200);
    expect(await vus(alice)).toContain(T);

    // statistiques, pause, programmé, terminé
    const liste = (await http.get('/api/admin/annonces').set(auth(admin))).body;
    const st = liste.find((x: any) => x.id === a.id);
    expect(st).toMatchObject({ etat: 'EN_COURS', stats: { occurrence: 2 } });
    expect(st.prochaine).toBeTruthy();
    await http.patch(`/api/admin/annonces/${a.id}`).set(auth(admin)).send({ actif: false }).expect(200);
    expect(await vus(alice)).not.toContain(T);
    await http.patch(`/api/admin/annonces/${a.id}`).set(auth(admin)).send({ actif: true, debut: new Date(Date.now() + 86400000) }).expect(200);
    expect(await vus(alice)).not.toContain(T); // programmé pour demain
    // message ponctuel important pour tous, avec une fin passée : invisible
    const b = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Fin ${id}`, texte: 'terminé', niveau: 'IMPORTANT', fin: new Date(Date.now() - 1000), debut: new Date(Date.now() - 86400000) })).body;
    expect(await vus(bob)).not.toContain(`Fin ${id}`);
    await http.delete(`/api/admin/annonces/${a.id}`).set(auth(admin)).expect(200);
    await http.delete(`/api/admin/annonces/${b.id}`).set(auth(admin)).expect(200);
  });

  it('messages : question avec réponses, résultats et export CSV', async () => {
    const ids = async (t: string) => (await http.get('/api/annonces').set(auth(t))).body.map((a: any) => a.id);
    // validation côté admin
    expect((await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: 'Q', texte: 'Sondage', questionType: 'CHOIX', question: 'Quoi ?', options: ['Seul'] })).status).toBe(400);
    const q = (await http.post('/api/admin/annonces').set(auth(admin)).send({
      titre: `Sondage ${id}`, texte: 'Une question rapide', questionType: 'CHOIX', question: 'Quel matériau décapez-vous le plus ?',
      options: ['Acier', 'Aluminium', 'Bois'], autreOption: true, reponseObligatoire: true, debut: new Date(Date.now() - 60000),
    })).body;
    const vue = (await http.get('/api/annonces').set(auth(alice))).body.find((a: any) => a.id === q.id);
    expect(vue.question).toMatchObject({ type: 'CHOIX', options: ['Acier', 'Aluminium', 'Bois'], autre: true, obligatoire: true });
    // obligatoire : « J'ai compris » refusé ; réponse invalide refusée
    expect((await http.post(`/api/annonces/${q.id}/compris`).set(auth(alice))).status).toBe(400);
    expect((await http.post(`/api/annonces/${q.id}/reponse`).set(auth(alice)).send({ valeur: 'Granit' })).status).toBe(400);
    await http.post(`/api/annonces/${q.id}/reponse`).set(auth(alice)).send({ valeur: 'Autre', autre: 'Pierre de taille' }).expect(201);
    await http.post(`/api/annonces/${q.id}/reponse`).set(auth(bob)).send({ valeur: 'Acier' }).expect(201);
    expect(await ids(alice)).not.toContain(q.id); // répondu → masqué
    // résultats
    const r = (await http.get(`/api/admin/annonces/${q.id}/reponses`).set(auth(admin))).body;
    expect(r.total).toBe(2);
    expect(r.resume).toEqual(expect.arrayContaining([{ valeur: 'Acier', nombre: 1 }, { valeur: 'Autre', nombre: 1 }]));
    expect(r.reponses.find((x: any) => x.valeur === 'Autre')).toMatchObject({ autre: 'Pierre de taille', user: { identifiant: `alice-${id}` } });
    const csv = await http.get(`/api/admin/annonces/${q.id}/reponses.csv`).set(auth(admin));
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`alice-${id}`);
    expect(csv.text).toContain('Pierre de taille');
    expect((await http.get(`/api/admin/annonces/${q.id}/reponses`).set(auth(bob))).status).toBe(403);

    // note 1 à 5 : moyenne
    const n = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Note ${id}`, texte: 'Satisfait ?', questionType: 'NOTE', question: 'Votre note ?', debut: new Date(Date.now() - 60000) })).body;
    expect((await http.post(`/api/annonces/${n.id}/reponse`).set(auth(alice)).send({ valeur: '6' })).status).toBe(400);
    await http.post(`/api/annonces/${n.id}/reponse`).set(auth(alice)).send({ valeur: '5' }).expect(201);
    await http.post(`/api/annonces/${n.id}/reponse`).set(auth(bob)).send({ valeur: '2' }).expect(201);
    expect((await http.get(`/api/admin/annonces/${n.id}/reponses`).set(auth(admin))).body.moyenne).toBe(3.5);
    // facultative : on peut passer
    const o = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Oui ${id}`, texte: 'Petit rappel', questionType: 'OUI_NON', question: 'Lentille nettoyée ?', debut: new Date(Date.now() - 60000) })).body;
    await http.post(`/api/annonces/${o.id}/compris`).set(auth(alice)).expect(201);
    expect(await ids(alice)).not.toContain(o.id);
    for (const x of [q, n, o]) await http.delete(`/api/admin/annonces/${x.id}`).set(auth(admin)).expect(200);
  });

  it('n° client Odoo : création, recherche, ciblage d\'un message', async () => {
    const num = `C-${id}`;
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'odoo' })).body.cle;
    // création depuis Odoo avec le n° client
    const u = (await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `dave-${id}`, motDePasse: 'motdepasse1', numeroOdoo: ` ${num} ` })).body;
    expect(u.numeroOdoo).toBe(num);
    // recherche par n° (clé API) et par recherche libre (admin)
    expect((await http.get(`/api/users?numeroOdoo=${num}`).set('X-Api-Key', cle)).body.map((x: any) => x.id)).toEqual([u.id]);
    expect((await http.get(`/api/users?q=${num.toLowerCase()}`).set(auth(admin))).body.some((x: any) => x.id === u.id)).toBe(true);
    // modification / effacement du n°
    const aliceId = (await http.get('/api/moi').set(auth(alice))).body.id;
    expect((await http.patch(`/api/users/${aliceId}`).set(auth(admin)).send({ numeroOdoo: num })).body.numeroOdoo).toBe(num);
    // message ciblé sur ce n° : 2 comptes (dave, alice), bob ne le voit pas
    expect((await http.post('/api/admin/annonces/cible').set(auth(admin)).send({ numerosOdoo: [num] })).body.utilisateurs).toBe(2);
    const a = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Pour ${num}`, texte: 'Message ciblé', numerosOdoo: [num, ' ', num], debut: new Date(Date.now() - 60000) })).body;
    expect(a.numerosOdoo).toEqual([num]);
    const voit = async (t: string) => (await http.get('/api/annonces').set(auth(t))).body.some((x: any) => x.id === a.id);
    expect(await voit(alice)).toBe(true);
    expect(await voit(bob)).toBe(false);
    await http.patch(`/api/users/${aliceId}`).set(auth(admin)).send({ numeroOdoo: null }).expect(200);
    expect(await voit(alice)).toBe(false);
    await http.delete(`/api/admin/annonces/${a.id}`).set(auth(admin)).expect(200);
  });

  it('espaces : Lazzeko / Kiavik, accès par module, conditions et messages par espace', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'espaces' })).body.cle;
    // configuration publique et manifeste selon l'adresse
    const espaces = (await http.get('/api/espaces')).body;
    expect(espaces.map((e: any) => e.slug)).toEqual(['lazzeko', 'kiavik']);
    expect((await http.get('/api/espace').set('Host', 'app.kiavikcopilot.ovh')).body.slug).toBe('kiavik');
    expect((await http.get('/api/espace').set('Host', 'app.lazzeko.com')).body.slug).toBe('lazzeko');
    expect((await http.get('/api/manifest.webmanifest').set('Host', 'app.kiavikcopilot.ovh')).body.name).toBe('Kiavik Copilot');

    // emma : Kiavik seulement (guide Flexiprint)
    const emma = (await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `emma-${id}`, motDePasse: 'motdepasse1', modules: ['guide-flexiprint'] })).body;
    expect(emma.modules).toEqual(['guide-flexiprint']);
    expect(emma.espaces).toEqual(['kiavik']);
    expect((await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `zz-${id}`, motDePasse: 'motdepasse1', modules: ['inconnu'] })).status).toBe(400);
    const te = (await http.post('/api/auth/connexion').send({ identifiant: `emma-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const K = { ...auth(te), 'X-Espace': 'kiavik' };
    // pas d'accès aux réglages Lazzeko
    const refus = await http.get('/api/fiches').set(K);
    expect(refus.status).toBe(403);
    expect(refus.body.code).toBe('MODULE_NON_AUTORISE');
    // conditions Kiavik (texte propre, sans communauté), à accepter
    const moi0 = (await http.get('/api/moi').set(K)).body;
    expect(moi0.espaces).toEqual([{ slug: 'kiavik', conditionsAJour: false }]);
    expect(moi0.conditionsAJour).toBe(false);
    expect((await http.get('/api/annonces').set(K)).body.code).toBe('CONDITIONS_A_ACCEPTER');
    const ck = (await http.get('/api/conditions?espace=kiavik').set(K)).body;
    expect(ck.texte).toContain('Kiavik');
    await http.post('/api/moi/conditions').set(K).send({ version: ck.version, accordPhotosMarketing: true }).expect(201);
    const moi1 = (await http.get('/api/moi').set(K)).body;
    expect(moi1.conditionsAJour).toBe(true);
    expect(moi1.accordPhotosMarketing).toBe(false); // l'accord photos ne concerne que Lazzeko
    // les conditions Lazzeko d'alice ne sont pas touchées par une nouvelle version Kiavik
    await http.post('/api/admin/conditions').set(auth(admin)).send({ espace: 'kiavik', texte: ck.texte }).expect(201);
    expect((await http.get('/api/moi').set(auth(alice))).body.conditionsAJour).toBe(true);
    expect((await http.get('/api/moi').set(K)).body.conditionsAJour).toBe(false);
    await http.post('/api/moi/conditions').set(K).send({ espace: 'kiavik', version: ck.version + 1 }).expect(201);

    // guides : seulement ceux des modules du compte ; notes « à compléter » réservées à l'admin
    expect((await http.get('/api/guides').set(K)).body.map((g: any) => g.slug)).toEqual(['flexiprint']);
    const fp = (await http.get('/api/guides/flexiprint').set(K)).body;
    expect(fp.ecrans.find((e: any) => e.id === 't3').pastilles.length).toBeGreaterThan(0);
    expect(fp.modesBlanc.modes).toHaveLength(7);
    expect(fp.ecrans.find((e: any) => e.id === 't9').interactif.images.c).toMatch(/^\/api\/guides\/images\/ch_c/);
    expect(fp.animations.map((a: any) => a.id)).toEqual(['couleur-simple', 'couleur-blanc', 'reglages-blanc']);
    const dxRefus = await http.get('/api/guides/dxonjet').set(K);
    expect(dxRefus.status).toBe(403);
    expect(dxRefus.body.code).toBe('MODULE_NON_AUTORISE');
    expect((await http.get('/api/guides').set(auth(alice))).body).toEqual([]);
    expect((await http.get('/api/guides/flexiprint').set(auth(alice))).body.code).toBe('MODULE_NON_AUTORISE');
    const aCompleter = (g: any) => g.ecrans.flatMap((e: any) => e.pastilles).filter((p: any) => p.niveau === 'a_completer');
    const notesAdmin = aCompleter((await http.get('/api/guides/dxonjet').set(auth(admin))).body).length; // peut tomber à 0 quand tout est complété
    await http.patch(`/api/users/${emma.id}`).set(auth(admin)).send({ modules: ['guide-flexiprint', 'guide-dxonjet'] }).expect(200);
    const accueil = (await http.get('/api/guides').set(K)).body;
    expect(accueil.map((g: any) => g.slug)).toEqual(['flexiprint', 'dxonjet']);
    expect(accueil[1]).toMatchObject({ nomCourt: 'DXonJet', role: 'Imprimer sur le mur', miniature: '/api/guides/images/dx/d1.jpg' });
    const dx = (await http.get('/api/guides/dxonjet').set(K)).body;
    const offre = dx.animations.find((a: any) => a.id === 'offre-composition');
    expect(offre.liens).toContainEqual(['d4a', 'a.6']);
    expect(offre.photos.mireMoins4.image).toMatch(/^\/api\/guides\/images\/dx\/offre_mire_moins4\.svg$/);
    expect((await http.get(offre.photos.mireMoins4.image)).headers['content-type']).toContain('image/svg+xml');
    expect(aCompleter(dx)).toEqual([]);
    expect(notesAdmin).toBeGreaterThanOrEqual(aCompleter(dx).length);
    expect(dx.ecrans[0].image).toMatch(/^\/api\/guides\/images\//);
    const img = await http.get(dx.ecrans[0].image);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect((await http.get('/api/guides/images/..%2F..%2Fpackage.json')).status).toBe(404);

    // messages par espace : Kiavik → emma seulement ; « tous » → chacun dans son espace
    const mk = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Kiavik ${id}`, texte: 'Nouveau guide', espaces: ['kiavik'], lienUrl: '/guides', debut: new Date(Date.now() - 60000) })).body;
    const ml = (await http.post('/api/admin/annonces').set(auth(admin)).send({ titre: `Lazzeko ${id}`, texte: 'Nouveau réglage', espaces: ['lazzeko'], debut: new Date(Date.now() - 60000) })).body;
    const voit = async (h: Record<string, string>, a: any) => (await http.get('/api/annonces').set(h)).body.some((x: any) => x.id === a.id);
    expect(await voit(K, mk)).toBe(true);
    expect(await voit(K, ml)).toBe(false);
    expect(await voit(auth(alice), mk)).toBe(false);
    expect(await voit(auth(alice), ml)).toBe(true);
    // emma n'a pas accès à Lazzeko : rien même si elle ouvre l'espace Lazzeko
    expect(await voit({ ...auth(te), 'X-Espace': 'lazzeko' }, ml)).toBe(false);
    const nk = (await http.post('/api/admin/annonces/cible').set(auth(admin)).send({ espaces: ['kiavik'] })).body.utilisateurs;
    expect(nk).toBeGreaterThan(0);

    // un compte dans les deux espaces : l'admin ajoute le module Lazzeko à emma
    const e2 = (await http.patch(`/api/users/${emma.id}`).set(auth(admin)).send({ modules: ['guide-flexiprint', 'reglages-decapage'] })).body;
    expect(e2.espaces).toEqual(['lazzeko', 'kiavik']);
    expect((await http.get('/api/fiches').set({ ...auth(te), 'X-Espace': 'lazzeko' })).body.code).toBe('CONDITIONS_A_ACCEPTER');
    expect((await http.get(`/api/users?espace=kiavik`).set(auth(admin))).body.some((u: any) => u.id === emma.id)).toBe(true);
    // retrait de Kiavik
    expect((await http.patch(`/api/users/${emma.id}`).set(auth(admin)).send({ modules: ['reglages-decapage'] })).body.espaces).toEqual(['lazzeko']);
    for (const a of [mk, ml]) await http.delete(`/api/admin/annonces/${a.id}`).set(auth(admin)).expect(200);
  });

  it('procédures Kiavik : admin crée, client lit les publiées, liens vers les guides', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'procedures' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `paul-${id}`, motDePasse: 'motdepasse1', modules: ['procedures-kiavik', 'guide-flexiprint'] }).expect(201);
    const tp = (await http.post('/api/auth/connexion').send({ identifiant: `paul-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const P = { ...auth(tp), 'X-Espace': 'kiavik' };
    const { version } = (await http.get('/api/conditions?espace=kiavik').set(P)).body;
    await http.post('/api/moi/conditions').set(P).send({ version }).expect(201);

    // procédures livrées par le seed (reprises du prototype)
    const depart = (await http.get('/api/procedures').set(P)).body;
    const simple = depart.find((p: any) => p.titre.startsWith('Imprimer en couleur simple'));
    expect(simple.liens).toContainEqual({ guide: 'flexiprint', ecran: 't4', pastille: '4.1' });
    expect(depart.every((p: any) => p.publiee)).toBe(true); // brouillons invisibles

    // création par l'admin (brouillon), étapes, ordre, lien, photo
    const p = (await http.post('/api/admin/procedures').set(auth(admin)).send({ titre: `Test ${id}`, categorie: 'Entretien' })).body;
    expect(p.publiee).toBe(false);
    expect((await http.post(`/api/admin/procedures/${p.id}/etapes`).set(auth(admin)).send({ texte: 'Lien faux', guide: 'flexiprint', ecran: 't4', pastille: '99' })).status).toBe(400);
    await http.post(`/api/admin/procedures/${p.id}/etapes`).set(auth(admin)).send({ texte: 'Première', guide: 'flexiprint', ecran: 't4', pastille: '4.1' }).expect(201);
    const d = (await http.post(`/api/admin/procedures/${p.id}/etapes`).set(auth(admin)).send({ texte: 'Deuxième', avertissement: 'Attention', guide: 'flexiprint', ecran: 't1', pastille: 'E' })).body;
    const e2 = d.etapes[1].id;
    const apres = (await http.post(`/api/admin/procedures/etapes/${e2}/deplacer`).set(auth(admin)).send({ sens: -1 })).body;
    expect(apres.etapes.map((e: any) => e.texte)).toEqual(['Deuxième', 'Première']);
    const ph = await http.post(`/api/admin/procedures/etapes/${e2}/photo`).set(auth(admin)).attach('photo', JPEG, 'a.jpg');
    expect(ph.status).toBe(201);
    const urlPhoto = ph.body.etapes[0].photo;
    expect(urlPhoto).toBe(`/procedures/photos/${ph.body.etapes[0].photos[0].id}`);
    // plusieurs photos : ajout à la fin, ordre, suppression d'une seule
    const ph2 = (await http.post(`/api/admin/procedures/etapes/${e2}/photo`).set(auth(admin)).attach('photo', JPEG, 'b.jpg')).body.etapes[0].photos;
    expect(ph2).toHaveLength(2);
    const inv = (await http.post(`/api/admin/procedures/photos/${ph2[1].id}/deplacer`).set(auth(admin)).send({ sens: -1 })).body.etapes[0].photos;
    expect(inv.map((x: any) => x.id)).toEqual([ph2[1].id, ph2[0].id]);
    const une = (await http.delete(`/api/admin/procedures/photos/${ph2[1].id}`).set(auth(admin))).body.etapes[0];
    expect(une.photos.map((x: any) => x.id)).toEqual([ph2[0].id]);
    expect(une.photo).toBe(urlPhoto);

    // le client ne voit pas le brouillon, ni sa photo ; ne peut pas modifier
    expect((await http.get(`/api/procedures/${p.id}`).set(P)).status).toBe(404);
    expect((await http.get(`/api${urlPhoto}`).set(P)).status).toBe(404);
    expect((await http.post('/api/admin/procedures').set(P).send({ titre: 'pirate' })).status).toBe(403);
    await http.patch(`/api/admin/procedures/${p.id}`).set(auth(admin)).send({ publiee: true }).expect(200);
    const lu = (await http.get(`/api/procedures/${p.id}`).set(P)).body;
    expect(lu.etapes[0]).toMatchObject({ texte: 'Deuxième', avertissement: 'Attention', guide: 'flexiprint', ecran: 't1', pastille: 'E' });
    expect((await http.get(`/api${urlPhoto}`).set(P)).headers['content-type']).toBe('image/jpeg');

    // module requis
    const refus = await http.get('/api/procedures').set({ ...auth(alice), 'X-Espace': 'kiavik' });
    expect(refus.body.code).toBe('MODULE_NON_AUTORISE');

    await http.delete(`/api/admin/procedures/${p.id}`).set(auth(admin)).expect(200);
    expect((await http.get(`/api/procedures/${p.id}`).set(P)).status).toBe(404);
  });

  it('diagnostic : questions, détours, retour sur la route, envoi du résultat, catalogue et export pour l\'IA', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'diagnostic' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `dia-${id}`, motDePasse: 'motdepasse1', modules: ['procedures-kiavik'] }).expect(201);
    const tc = (await http.post('/api/auth/connexion').send({ identifiant: `dia-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const C = { ...auth(tc), 'X-Espace': 'kiavik' };
    const { version } = (await http.get('/api/conditions?espace=kiavik').set(C)).body;
    await http.post('/api/moi/conditions').set(C).send({ version }).expect(201);
    const A = auth(admin);

    // route : 1, ❓ pompe (Non → détour « bouton » puis fin contact ; Oui → retour), 2
    const p = (await http.post('/api/admin/procedures').set(A).send({ titre: `Diag ${id}`, categorie: 'Diagnostic', description: 'Pompe à encre' })).body;
    await http.post(`/api/admin/procedures/${p.id}/etapes`).set(A).send({ texte: 'Allumer' }).expect(201);
    await http.post(`/api/admin/procedures/${p.id}/etapes`).set(A).send({ texte: 'Tester les buses' }).expect(201);
    let d = (await http.post(`/api/admin/procedures/${p.id}/etapes`).set(A).send({ texte: 'Pompe — Tu entends la pompe ?', position: 1, note: 'commande ?' })).body;
    const q = d.etapes.find((e: any) => e.texte.startsWith('Pompe'));
    expect(d.etapes.filter((e: any) => !e.brancheId).map((e: any) => e.texte)).toEqual(['Allumer', 'Pompe — Tu entends la pompe ?', 'Tester les buses']);
    await http.post(`/api/admin/procedures/etapes/${q.id}/choix`).set(A).send({ libelle: 'Oui' }).expect(201);
    d = (await http.post(`/api/admin/procedures/etapes/${q.id}/choix`).set(A).send({ libelle: 'Non' })).body;
    const [oui, non] = d.etapes.find((e: any) => e.id === q.id).choix;
    d = (await http.post(`/api/admin/procedures/${p.id}/etapes`).set(A).send({ texte: 'Vérifier le bouton Pompe', brancheId: non.id })).body;
    expect(d.etapes.find((e: any) => e.brancheId === non.id).ordre).toBe(0);
    expect((await http.patch(`/api/admin/procedures/choix/${non.id}`).set(A).send({ suite: 'nimporte' })).status).toBe(400);
    expect((await http.patch(`/api/admin/procedures/choix/${non.id}`).set(A).send({ suite: 'etape', etapeCibleId: d.etapes.find((e: any) => e.brancheId).id })).status).toBe(400);
    await http.patch(`/api/admin/procedures/choix/${non.id}`).set(A).send({ suite: 'contact', conclusion: 'Panne de pompe', signification: 'pas de commande' }).expect(200);
    await http.patch(`/api/admin/procedures/${p.id}`).set(A).send({ publiee: true, prompt: 'Sois bref' }).expect(200);

    // le client voit les questions, sans les notes ni les significations
    const lu = (await http.get(`/api/procedures/${p.id}`).set(C)).body;
    const qc = lu.etapes.find((e: any) => e.id === q.id);
    expect(qc.choix.map((c: any) => c.libelle)).toEqual(['Oui', 'Non']);
    expect(qc.note).toBeUndefined();
    expect(qc.choix[1].signification).toBeUndefined();
    expect(lu.prompt).toBeUndefined();

    // envoi : chemin recalculé par le serveur
    expect((await http.post(`/api/procedures/${p.id}/diagnostic`).set(C).send({ reponses: {} })).status).toBe(400);
    const env = (await http.post(`/api/procedures/${p.id}/diagnostic`).set(C).send({ reponses: { [q.id]: non.id }, message: 'aide' })).body;
    expect(env.texte).toBe('Tu entends la pompe ? : Non\n→ À contacter (problème non résolu) : Panne de pompe');
    const recus = (await http.get('/api/admin/diagnostics?nonLus=1').set('X-Api-Key', cle)).body;
    const r = recus.diagnostics.find((x: any) => x.id === env.id);
    expect(r).toMatchObject({ message: 'aide', resultat: { fin: { type: 'contact' }, chemin: [{ question: 'Tu entends la pompe ?', reponse: 'Non', signification: 'pas de commande' }] } });
    await http.patch(`/api/admin/diagnostics/${env.id}`).set(A).send({ lu: true }).expect(200);
    expect((await http.get('/api/admin/diagnostics').set(C)).status).toBe(403);
    const oui1 = (await http.post(`/api/procedures/${p.id}/diagnostic`).set(C).send({ reponses: { [q.id]: oui.id } })).body;
    expect(oui1.texte).toBe('Tu entends la pompe ? : Oui\n→ Parcours terminé');

    // IA : prompt général, catalogue, export de l'arbre (clé API)
    await http.put('/api/ia/prompt').set(A).send({ texte: 'Tu es l\'assistant Kiavik.' }).expect(200);
    const cat = (await http.get('/api/ia/catalogue').set('X-Api-Key', cle)).body;
    expect(cat.promptGeneral).toBe('Tu es l\'assistant Kiavik.');
    expect(cat.procedures.find((x: any) => x.id === p.id)).toMatchObject({ description: 'Pompe à encre', diagnostic: true });
    const ex = (await http.get(`/api/ia/procedures/${p.id}`).set('X-Api-Key', cle)).body;
    expect(ex.prompt).toBe('Sois bref');
    expect(ex.route[1]).toMatchObject({ question: true, note: 'commande ?', reponses: [{ libelle: 'Oui', suite: 'retour' }, { libelle: 'Non', suite: 'contact', detour: [{ texte: 'Vérifier le bouton Pompe' }] }] });
    expect((await http.get('/api/ia/catalogue').set(C)).status).toBe(403);
    // résumé texte automatique (sans IA) et paquet à coller dans une IA
    expect(ex.resumeTexte).toContain('❓ Tu entends la pompe ?');
    expect(ex.resumeTexte).toContain('→ Non (pas de commande) :');
    expect(ex.resumeTexte).toContain('FIN : contacter Kiavik — Panne de pompe');
    expect(ex.paquet).toMatch(/^# Consignes générales\nTu es l'assistant Kiavik\.\n\n# Consignes pour « Diag .* »\nSois bref\n\n# Procédure\nProcédure : Diag/);
    const pq = (await http.get(`/api/admin/diagnostics/${env.id}/paquet`).set(A)).body.texte;
    expect(pq).toContain('# Résultat du client\nTu entends la pompe ? : Non');
    expect(pq).toContain('# Message du client\naide');
    await http.put('/api/ia/prompt').set(A).send({ texte: '' }).expect(200);

    // « pas clair ? » : un seul signalement ouvert par client et par étape ; l'admin le traite
    await http.post(`/api/procedures/etapes/${q.id}/signaler`).set(C).send({ message: 'Je ne sais pas où écouter' }).expect(201);
    await http.post(`/api/procedures/etapes/${q.id}/signaler`).set(C).send({ message: 'Près de la bouteille ?' }).expect(201);
    let sig = (await http.get(`/api/admin/procedures/${p.id}/signalements`).set(A)).body;
    expect(sig).toHaveLength(1);
    expect(sig[0]).toMatchObject({ etapeId: q.id, message: 'Près de la bouteille ?', traite: false });
    expect((await http.get('/api/admin/procedures/signalements/ouverts').set(A)).body[p.id]).toBe(1);
    await http.patch(`/api/admin/procedures/signalements/${sig[0].id}`).set(A).send({ traite: true }).expect(200);
    expect((await http.get('/api/admin/procedures/signalements/ouverts').set(A)).body[p.id]).toBeUndefined();
    expect((await http.get(`/api/admin/procedures/${p.id}/signalements`).set(C)).status).toBe(403);

    // statistiques anonymes : deux tentatives (Non → contact ; Oui, arrêtée sur « Tester les buses »), les admins ne comptent pas
    const tester = (await http.get(`/api/procedures/${p.id}`).set(A)).body.etapes.find((e: any) => e.texte === 'Tester les buses');
    await http.put(`/api/procedures/${p.id}/suivi`).set(C).send({ session: `s1-${id}`, reponses: { [q.id]: non.id }, faites: 2, total: 3, derniere: q.id, fin: 'contact' }).expect(200);
    await http.put(`/api/procedures/${p.id}/suivi`).set(C).send({ session: `s2-${id}`, reponses: { [q.id]: oui.id }, faites: 2, total: 3, derniere: tester.id, fin: null }).expect(200);
    await http.put(`/api/procedures/${p.id}/suivi`).set(A).send({ session: `s3-${id}`, reponses: { [q.id]: oui.id }, faites: 1, total: 3, fin: 'termine' }).expect(200);
    expect((await http.put(`/api/procedures/${p.id}/suivi`).set(C).send({ session: `s4-${id}`, reponses: {}, faites: 0, total: 1, fin: 'bof' })).status).toBe(400);
    const st = (await http.get(`/api/admin/procedures/${p.id}/stats`).set(A)).body;
    expect(st).toMatchObject({ tentatives: 2, terminees: 1, fins: { contact: 1 }, choix: { [oui.id]: 1, [non.id]: 1 }, arrets: { [tester.id]: 1 }, envoyes: 2 });

    // historique du client
    const miens = (await http.get('/api/procedures/diagnostics/miens').set(C)).body;
    expect(miens.map((x: any) => x.id)).toEqual([oui1.id, env.id]);
    expect(miens[1]).toMatchObject({ message: 'aide', procedure: { id: p.id }, resultat: { fin: { type: 'contact', conclusion: 'Panne de pompe' } } });

    // copie complète (brouillon) : détour, réponses, saut vers une étape, photo
    const allumer = (await http.get(`/api/procedures/${p.id}`).set(A)).body.etapes.find((e: any) => e.texte === 'Allumer');
    await http.patch(`/api/admin/procedures/choix/${oui.id}`).set(A).send({ suite: 'etape', etapeCibleId: allumer.id }).expect(200);
    await http.post(`/api/admin/procedures/etapes/${allumer.id}/photo`).set(A).attach('photo', JPEG, 'a.jpg').expect(201);
    const cp = (await http.post(`/api/admin/procedures/${p.id}/dupliquer`).set(A)).body;
    expect(cp).toMatchObject({ titre: `Diag ${id} (copie)`, publiee: false, description: 'Pompe à encre', prompt: 'Sois bref' });
    expect(cp.etapes).toHaveLength(4);
    const qcp = cp.etapes.find((e: any) => e.choix.length);
    const allumerCp = cp.etapes.find((e: any) => e.texte === 'Allumer');
    expect(qcp.id).not.toBe(q.id);
    expect(qcp.choix[0]).toMatchObject({ libelle: 'Oui', suite: 'etape', etapeCibleId: allumerCp.id });
    expect(cp.etapes.find((e: any) => e.brancheId === qcp.choix[1].id).texte).toBe('Vérifier le bouton Pompe');
    expect(allumerCp.photos).toHaveLength(1);
    expect(allumerCp.photo).toBe(`/procedures/photos/${allumerCp.photos[0].id}`);
    expect((await http.get(`/api/procedures/etapes/${allumerCp.id}/photo`).set(A)).headers['content-type']).toBe('image/jpeg'); // ancienne adresse
    expect((await http.get(`/api${allumerCp.photo}`).set(A)).headers['content-type']).toBe('image/jpeg');
    expect((await http.post(`/api/admin/procedures/${p.id}/dupliquer`).set(C)).status).toBe(403);

    // procédure suivante (« Continuer avec … ? » à la fin) : gardée à la copie, dans le résumé IA, retirée si la suivante est supprimée
    expect((await http.patch(`/api/admin/procedures/${p.id}`).set(A).send({ suivanteId: p.id })).status).toBe(400);
    expect((await http.patch(`/api/admin/procedures/${p.id}`).set(A).send({ suivanteId: 'inconnue' })).status).toBe(404);
    expect((await http.patch(`/api/admin/procedures/${p.id}`).set(C).send({ suivanteId: cp.id })).status).toBe(403);
    expect((await http.patch(`/api/admin/procedures/${p.id}`).set(A).send({ suivanteId: cp.id })).body.suivanteId).toBe(cp.id);
    expect((await http.get(`/api/procedures/${p.id}`).set(C)).body.suivanteId).toBe(cp.id);
    expect((await http.get(`/api/ia/procedures/${p.id}`).set('X-Api-Key', cle)).body.resumeTexte).toContain(`➡ procédure « Diag ${id} (copie) »`);
    expect((await http.get('/api/procedures').set(A)).body.find((x: any) => x.id === p.id).suivanteId).toBe(cp.id);
    expect((await http.post(`/api/admin/procedures/${p.id}/dupliquer`).set(A)).body.suivanteId).toBe(cp.id);
    await http.delete(`/api/admin/procedures/${cp.id}`).set(A).expect(200);
    expect((await http.get(`/api/procedures/${p.id}`).set(A)).body.suivanteId).toBeNull();
    for (const x of (await http.get('/api/procedures').set(A)).body.filter((x: any) => x.titre === `Diag ${id} (copie)`))
      await http.delete(`/api/admin/procedures/${x.id}`).set(A).expect(200);

    // supprimer la question supprime ses réponses et leurs détours
    d = (await http.delete(`/api/admin/procedures/etapes/${q.id}`).set(A)).body;
    expect(d.etapes.map((e: any) => e.texte)).toEqual(['Allumer', 'Tester les buses']);
    await http.delete(`/api/admin/procedures/${p.id}`).set(A).expect(200);
  });

  it('accueil et catégories : ajouter, renommer (le contenu suit), ordre, masquer, ranger, supprimer en déplaçant', async () => {
    const A = auth(admin);
    const cle = (await http.post('/api/admin/cles-api').set(A).send({ nom: 'categories' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `cat-${id}`, motDePasse: 'motdepasse1', modules: ['procedures-kiavik'] }).expect(201);
    const C = { ...auth((await http.post('/api/auth/connexion').send({ identifiant: `cat-${id}`, motDePasse: 'motdepasse1' })).body.jeton), 'X-Espace': 'kiavik' };
    const { version } = (await http.get('/api/conditions?espace=kiavik').set(C)).body;
    await http.post('/api/moi/conditions').set(C).send({ version }).expect(201);
    const cats = async () => (await http.get('/api/categories').set(C)).body as any[];
    const cat = async (nom: string) => (await cats()).find((c) => c.nom === nom);

    // reprises du départ (avec leurs icônes), dans l'ordre de l'accueil
    expect((await cats()).map((c) => c.nom)).toEqual(expect.arrayContaining(['Mise en route', 'Diagnostic', 'Impression']));
    expect(await cat('Diagnostic')).toMatchObject({ icone: '🩺' });

    // ajouter (admin seulement, pas de doublon), une catégorie tapée sur une procédure est créée aussi
    expect((await http.post('/api/admin/categories').set(C).send({ nom: `Blanc ${id}` })).status).toBe(403);
    await http.post('/api/admin/categories').set(A).send({ nom: `Blanc ${id}`, icone: '⚪' }).expect(201);
    expect((await http.post('/api/admin/categories').set(A).send({ nom: `Blanc ${id}` })).status).toBe(400);
    const p = (await http.post('/api/admin/procedures').set(A).send({ titre: `Proc ${id}`, categorie: `Auto ${id}` })).body;
    expect(await cat(`Auto ${id}`)).toMatchObject({ icone: '📁' });

    // ranger : procédure, astuce, animation (catégorie corrigée)
    const s = (await http.post('/api/admin/solutions').set(A).send({ titre: `Astuce ${id}`, texte: 'xx' })).body;
    const g = (await http.get('/api/guides').set(A)).body.find((x: any) => x.animations.length);
    const anim = g.animations[0];
    expect((await http.post('/api/admin/categories/ranger').set(A).send({ categorie: `Blanc ${id}`, elements: [{ type: 'animation', id: anim.id }] })).status).toBe(400);
    await http.post('/api/admin/categories/ranger').set(A).send({
      categorie: `Blanc ${id}`, elements: [{ type: 'procedure', id: p.id }, { type: 'astuce', id: s.id }, { type: 'animation', id: anim.id, guide: g.slug }],
    }).expect(201);
    const dans = async (nom: string) => (await http.get('/api/admin/categories/elements').set(A)).body.filter((e: any) => e.categorie === nom).map((e: any) => e.type).sort();
    expect(await dans(`Blanc ${id}`)).toEqual(['animation', 'astuce', 'procedure']);

    // renommer : garde icône et ordre, tout le contenu suit
    const b = await cat(`Blanc ${id}`);
    expect((await http.patch(`/api/admin/categories/${b.id}`).set(A).send({ nom: 'Impression' })).status).toBe(400);
    await http.patch(`/api/admin/categories/${b.id}`).set(A).send({ nom: `Blanc bis ${id}` }).expect(200);
    expect(await cat(`Blanc bis ${id}`)).toMatchObject({ id: b.id, icone: '⚪', ordre: b.ordre });
    expect(await cat(`Blanc ${id}`)).toBeUndefined();
    expect(await dans(`Blanc bis ${id}`)).toEqual(['animation', 'astuce', 'procedure']);
    expect((await http.get(`/api/procedures/${p.id}`).set(A)).body.categorie).toBe(`Blanc bis ${id}`);
    expect((await http.get('/api/guides').set(A)).body.find((x: any) => x.slug === g.slug).animations[0].categorie).toBe(`Blanc bis ${id}`);

    // ordre et masquée
    let l = (await http.post(`/api/admin/categories/${b.id}/deplacer`).set(A).send({ sens: -1 })).body;
    expect(l.findIndex((c: any) => c.id === b.id)).toBe(l.length - 3);
    await http.patch(`/api/admin/categories/${b.id}`).set(A).send({ masquee: true, icone: '🎨' }).expect(200);
    expect(await cat(`Blanc bis ${id}`)).toMatchObject({ masquee: true, icone: '🎨' });

    // supprimer : vide directement, sinon il faut dire où va le contenu
    const auto = await cat(`Auto ${id}`);
    await http.delete(`/api/admin/categories/${auto.id}`).set(A).expect(200);
    expect((await http.delete(`/api/admin/categories/${b.id}`).set(A)).status).toBe(400);
    const imp = await cat('Impression');
    await http.delete(`/api/admin/categories/${b.id}?vers=${imp.id}`).set(A).expect(200);
    expect(await cat(`Blanc bis ${id}`)).toBeUndefined();
    expect((await http.get(`/api/procedures/${p.id}`).set(A)).body.categorie).toBe('Impression');

    // ménage
    await http.delete(`/api/admin/guides/${g.slug}/animations/${anim.id}/categorie`).set(A).expect(200);
    await http.delete(`/api/admin/procedures/${p.id}`).set(A).expect(200);
    await http.delete(`/api/admin/solutions/${s.id}`).set(A).expect(200);
  });

  it('langue du compte : choisie par le client, par l\'admin ou à la création (clé API)', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'langue' })).body.cle;
    const u = (await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `lea-${id}`, motDePasse: 'motdepasse1', langue: 'en' })).body;
    expect(u.langue).toBe('en');
    expect((await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `zz2-${id}`, motDePasse: 'motdepasse1', langue: 'xx' })).status).toBe(400);
    // sans langue : celle du téléphone (null)
    expect((await http.get('/api/moi').set(auth(alice))).body.langue).toBeNull();
    expect((await http.patch('/api/moi/preferences').set(auth(alice)).send({ langue: 'en' })).body.langue).toBe('en');
    const moi = (await http.patch('/api/moi/preferences').set(auth(alice)).send({ langue: null })).body;
    expect(moi.langue).toBeNull();
    expect(moi.accordPhotosMarketing).toBeDefined(); // l'accord photos n'est pas touché
    expect((await http.patch('/api/moi/preferences').set(auth(alice)).send({ langue: 'xx' })).status).toBe(400);
    expect((await http.patch(`/api/users/${u.id}`).set(auth(admin)).send({ langue: 'fr' })).body.langue).toBe('fr');
  });

  it('corrections des guides par l\'admin : fiche d\'un bouton, sous-titre, photo, retour à l\'original', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'corrections' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `zoe-${id}`, motDePasse: 'motdepasse1', modules: ['guide-dxonjet'] }).expect(201);
    const tz = (await http.post('/api/auth/connexion').send({ identifiant: `zoe-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const Z = { ...auth(tz), 'X-Espace': 'kiavik' };
    const { version } = (await http.get('/api/conditions?espace=kiavik').set(Z)).body;
    await http.post('/api/moi/conditions').set(Z).send({ version }).expect(201);
    const a6 = (g: any) => g.ecrans.find((e: any) => e.id === 'd4a').pastilles.find((p: any) => p.id === 'a.6');
    const origine = a6((await http.get('/api/guides/dxonjet').set(Z)).body);

    // fiche d'un bouton
    const url = '/api/admin/guides/dxonjet/pastilles/d4a/a.6';
    expect((await http.put(url).set(Z).send({ titre: 'pirate', texte: 'x' })).status).toBe(403);
    expect((await http.put('/api/admin/guides/dxonjet/pastilles/d4a/zz').set(auth(admin)).send({ titre: 'Essai', texte: 'x' })).status).toBe(404);
    const g1 = (await http.put(url).set(auth(admin)).send({ titre: `Offre ${id}`, texte: 'Nouveau texte', conseil: 'Note interne', niveau: 'a_completer', mots_cles: ['offset', ' offset ', 'mire'] })).body;
    expect(a6(g1)).toMatchObject({ titre: `Offre ${id}`, corrige: true, niveau: 'a_completer', mots_cles: ['offset', 'mire'] });
    const vuClient = a6((await http.get('/api/guides/dxonjet').set(Z)).body);
    expect(vuClient).toMatchObject({ titre: `Offre ${id}`, texte: 'Nouveau texte' });
    expect(vuClient.conseil).toBeUndefined(); // note « à compléter » : admin seulement
    expect(vuClient.corrige).toBeUndefined();

    // sous-titre d'une animation
    const anim = '/api/admin/guides/dxonjet/animations/offre-composition';
    const g2 = (await http.put(`${anim}/etapes/0/0`).set(auth(admin)).send({ cap: `Nouveau sous-titre ${id}` })).body;
    expect(g2.animations.find((a: any) => a.id === 'offre-composition').scenes[0].etapes[0]).toMatchObject({ cap: `Nouveau sous-titre ${id}`, corrige: true });
    expect((await http.put(`${anim}/etapes/0/9`).set(auth(admin)).send({ cap: 'xx' })).status).toBe(404);

    // photo
    const ph = await http.post(`${anim}/photos/avant`).set(auth(admin)).attach('photo', JPEG, 'a.jpg');
    expect(ph.status).toBe(201);
    const image = ph.body.animations.find((a: any) => a.id === 'offre-composition').photos.avant.image;
    expect(image).toMatch(/^\/api\/guides\/corrections\/.+\/photo/);
    const img = await http.get(image);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect((await http.post(`${anim}/photos/avant`).set(auth(admin)).attach('photo', Buffer.from('pas une image'), 'a.jpg')).status).toBe(400);

    // retour à l'original
    await http.delete(url).set(auth(admin)).expect(200);
    await http.delete(`${anim}/etapes/0/0`).set(auth(admin)).expect(200);
    const g3 = (await http.delete(`${anim}/photos/avant`).set(auth(admin))).body;
    expect(a6(g3)).toMatchObject({ titre: origine.titre, texte: origine.texte });
    expect(g3.animations.find((a: any) => a.id === 'offre-composition').photos.avant.image).toMatch(/offre_grilles_avant/);
    expect((await http.get(image)).status).toBe(404);
  });

  it('astuces & solutions : fiches de départ, création par l\'admin, brouillon invisible, liens vérifiés, photo', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'solutions' })).body.cle;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `sam-${id}`, motDePasse: 'motdepasse1', modules: ['procedures-kiavik'] }).expect(201);
    const ts = (await http.post('/api/auth/connexion').send({ identifiant: `sam-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const C = { ...auth(ts), 'X-Espace': 'kiavik' };
    const { version } = (await http.get('/api/conditions?espace=kiavik').set(C)).body;
    await http.post('/api/moi/conditions').set(C).send({ version }).expect(201);

    // fiches livrées par le seed
    const depart = (await http.get('/api/solutions').set(C)).body;
    expect(depart.find((s: any) => s.titre.startsWith('Les couleurs sont floues'))).toMatchObject({ guide: 'dxonjet', ecran: 'd4a', pastille: 'a.6', publiee: true });

    // création (brouillon) par l'admin, liens vérifiés
    expect((await http.post('/api/admin/solutions').set(C).send({ titre: 'pirate', texte: 'x' })).status).toBe(403);
    expect((await http.post('/api/admin/solutions').set(auth(admin)).send({ titre: 'Essai lien', texte: 'xx', guide: 'dxonjet', ecran: 'd4a', pastille: 'zz' })).status).toBe(400);
    expect((await http.post('/api/admin/solutions').set(auth(admin)).send({ titre: 'Essai proc', texte: 'xx', procedureId: 'inconnue' })).status).toBe(400);
    const proc = (await http.get('/api/procedures').set(auth(admin))).body[0];
    const s = (await http.post('/api/admin/solutions').set(auth(admin)).send({
      titre: `Tête qui frotte ${id}`, texte: 'Reculer la tête.', cause: 'Distance trop faible', motsCles: ['frotte', ' frotte ', 'tête'],
      guide: 'dxonjet', ecran: 'd3a', pastille: 'a.4', procedureId: proc.id,
    })).body;
    expect(s).toMatchObject({ publiee: false, motsCles: ['frotte', 'tête'], procedureId: proc.id });
    expect((await http.get(`/api/solutions/${s.id}`).set(C)).status).toBe(404);
    expect((await http.get('/api/solutions').set(C)).body.some((x: any) => x.id === s.id)).toBe(false);

    // photo, publication
    const ph = await http.post(`/api/admin/solutions/${s.id}/photo`).set(auth(admin)).attach('photo', JPEG, 'a.jpg');
    expect(ph.status).toBe(201);
    expect((await http.get(`/api${ph.body.photo}`).set(C)).status).toBe(404); // brouillon
    await http.patch(`/api/admin/solutions/${s.id}`).set(auth(admin)).send({ publiee: true, cause: '' }).expect(200);
    const lue = (await http.get(`/api/solutions/${s.id}`).set(C)).body;
    expect(lue.cause).toBeNull();
    expect((await http.get(`/api${lue.photo}`).set(C)).headers['content-type']).toBe('image/jpeg');

    // module requis
    expect((await http.get('/api/solutions').set({ ...auth(alice), 'X-Espace': 'kiavik' })).body.code).toBe('MODULE_NON_AUTORISE');
    await http.delete(`/api/admin/solutions/${s.id}`).set(auth(admin)).expect(200);
    expect((await http.get(`/api/solutions/${s.id}`).set(C)).status).toBe(404);
  });

  it('journal d\'activité : connexions, pages et recherches des clients, visible par l\'admin', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'activite' })).body.cle;
    const u = (await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: `leo-${id}`, motDePasse: 'motdepasse1', modules: ['guide-dxonjet'] })).body;
    const tl = (await http.post('/api/auth/connexion').set('X-Espace', 'kiavik').send({ identifiant: `leo-${id}`, motDePasse: 'motdepasse1' })).body.jeton;
    const L = { ...auth(tl), 'X-Espace': 'kiavik' };
    await http.post('/api/activite').set(L).send({ type: 'page', chemin: '/guides/dxonjet/d4a?p=a.6', detail: 'D4-a → Offre' }).expect(204);
    await http.post('/api/activite').set(L).send({ type: 'recherche', detail: 'encre qui coule', resultats: 0, chemin: '/recherche' }).expect(204);
    expect((await http.post('/api/activite').set(L).send({ type: 'pirate' })).status).toBe(400);
    // l'admin n'est pas enregistré
    await http.post('/api/activite').set(auth(admin)).send({ type: 'page', chemin: '/admin' }).expect(204);
    await new Promise((r) => setTimeout(r, 300)); // enregistrement en arrière-plan

    expect((await http.get(`/api/admin/users/${u.id}/activite`).set(L)).status).toBe(403);
    const j = (await http.get(`/api/admin/users/${u.id}/activite?jours=1`).set(auth(admin))).body;
    expect(j.user.identifiant).toBe(`leo-${id}`);
    expect(j.activites.map((a: any) => a.type)).toEqual(['recherche', 'page', 'connexion']); // du plus récent au plus ancien
    expect(j.activites[0]).toMatchObject({ detail: 'encre qui coule', resultats: 0, espace: 'kiavik' });
    expect(j.activites[2].espace).toBe('kiavik');
    const adminId = (await http.get('/api/moi').set(auth(admin))).body.id;
    const ja = (await http.get(`/api/admin/users/${adminId}/activite?jours=1`).set(auth(admin))).body;
    expect(ja.activites.some((a: any) => a.chemin === '/admin')).toBe(false);
  });

  it('mot de passe oublié : demande, code donné par l\'admin (1 h, usage unique), nouveau mot de passe', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'mdp' })).body.cle;
    const ident = `mia-${id}`;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: ident, motDePasse: 'ancienmotdepasse', nom: 'Mia' }).expect(201);

    // même réponse que l'identifiant existe ou non
    expect((await http.post('/api/auth/mot-de-passe-oublie').send({ identifiant: `inconnu-${id}` })).body).toEqual({ ok: true });
    expect((await http.post('/api/auth/mot-de-passe-oublie').set('X-Espace', 'lazzeko').send({ identifiant: ident, message: 'Mia, atelier Lyon' })).body).toEqual({ ok: true });
    expect((await http.get('/api/admin/mots-de-passe').set(auth(alice))).status).toBe(403);
    const liste = (await http.get('/api/admin/mots-de-passe').set(auth(admin))).body;
    const d = liste.demandes.find((x: any) => x.user.identifiant === ident);
    expect(d).toMatchObject({ statut: 'EN_ATTENTE', message: 'Mia, atelier Lyon' });
    expect(liste.enAttente).toBeGreaterThan(0);

    // pas de code demandé : rien à réinitialiser
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code: '000000', nouveau: 'nouveaumotdepasse' })).status).toBe(400);
    const { code, expire } = (await http.post(`/api/admin/mots-de-passe/${d.id}/code`).set(auth(admin))).body;
    expect(code).toMatch(/^\d{6}$/);
    expect(new Date(expire).getTime() - Date.now()).toBeGreaterThan(59 * 60_000); // valable 1 h
    const faux = code === '123456' ? '654321' : '123456';
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code: faux, nouveau: 'nouveaumotdepasse' })).body.message).toBe('Code incorrect ou expiré');
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code, nouveau: 'court' })).status).toBe(400);
    const ok = await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code, nouveau: 'nouveaumotdepasse' });
    expect(ok.status).toBe(200);
    expect(ok.body.jeton).toBeTruthy();
    expect((await http.post('/api/auth/connexion').send({ identifiant: ident, motDePasse: 'ancienmotdepasse' })).status).toBe(401);
    expect((await http.post('/api/auth/connexion').send({ identifiant: ident, motDePasse: 'nouveaumotdepasse' })).status).toBe(200);
    // usage unique
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code, nouveau: 'encoreunautre' })).status).toBe(400);
    const apres = (await http.get('/api/admin/mots-de-passe').set(auth(admin))).body.demandes.find((x: any) => x.id === d.id);
    expect(apres.statut).toBe('UTILISEE');

    // 5 essais au plus
    await http.post('/api/auth/mot-de-passe-oublie').send({ identifiant: ident }).expect(200);
    const d2 = (await http.get('/api/admin/mots-de-passe').set(auth(admin))).body.demandes.find((x: any) => x.user.identifiant === ident && x.statut === 'EN_ATTENTE');
    const c2 = (await http.post(`/api/admin/mots-de-passe/${d2.id}/code`).set(auth(admin))).body.code;
    const f2 = c2 === '111111' ? '222222' : '111111';
    for (let k = 0; k < 5; k++) await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code: f2, nouveau: 'nouveaumotdepasse2' }).expect(400);
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code: c2, nouveau: 'nouveaumotdepasse2' })).status).toBe(400);

    // 3 demandes par heure au plus (la 4e est ignorée)
    await http.post('/api/auth/mot-de-passe-oublie').send({ identifiant: ident, message: 'troisième' }).expect(200);
    await http.post('/api/auth/mot-de-passe-oublie').send({ identifiant: ident, message: 'quatrième' }).expect(200);
    const msgs = (await http.get('/api/admin/mots-de-passe').set(auth(admin))).body.demandes.filter((x: any) => x.user.identifiant === ident).map((x: any) => x.message);
    expect(msgs).toContain('troisième');
    expect(msgs).not.toContain('quatrième');

    // notifications : clé publique pour l'admin seulement
    expect(typeof (await http.get('/api/push/cle').set(auth(admin))).body.cle).toBe('string');
    expect((await http.get('/api/push/cle').set(auth(alice))).status).toBe(403);
  });

  it('mot de passe oublié avec l\'email : n8n retrouve le compte et génère le code avec une clé API', async () => {
    const cle = (await http.post('/api/admin/cles-api').set(auth(admin)).send({ nom: 'n8n' })).body.cle;
    const ident = `noa-${id}`;
    await http.post('/api/users').set('X-Api-Key', cle).send({ identifiant: ident, motDePasse: 'ancienmotdepasse', nom: 'Noa', numeroOdoo: `C-${id}` }).expect(201);
    const email = `Noa.${id}@Exemple.fr`;
    expect((await http.post('/api/auth/mot-de-passe-oublie').set('X-Espace', 'kiavik').send({ identifiant: email, message: 'oublié mon identifiant' })).body).toEqual({ ok: true });

    // n8n (clé API) : liste des demandes → demande sans compte, avec l'email
    const liste = (await http.get('/api/admin/mots-de-passe').set('X-Api-Key', cle)).body;
    const d = liste.demandes.find((x: any) => x.email === email.toLowerCase());
    expect(d).toMatchObject({ statut: 'EN_ATTENTE', user: null, message: 'oublié mon identifiant' });
    // il faut indiquer le compte retrouvé dans Odoo
    expect((await http.post(`/api/admin/mots-de-passe/${d.id}/code`).set('X-Api-Key', cle).send({})).status).toBe(400);
    expect((await http.post(`/api/admin/mots-de-passe/${d.id}/code`).set('X-Api-Key', cle).send({ identifiant: `zz-${id}` })).status).toBe(404);
    const trouve = (await http.get(`/api/users?numeroOdoo=C-${id}`).set('X-Api-Key', cle)).body[0];
    const r = (await http.post(`/api/admin/mots-de-passe/${d.id}/code`).set('X-Api-Key', cle).send({ identifiant: trouve.identifiant })).body;
    expect(r).toMatchObject({ identifiant: ident, nom: 'Noa' });
    expect(r.code).toMatch(/^\d{6}$/);
    // le client saisit son identifiant (indiqué dans l'email) et le code
    expect((await http.post('/api/auth/reinitialiser').send({ identifiant: ident, code: r.code, nouveau: 'nouveaumotdepasse' })).body.jeton).toBeTruthy();
    const apres = (await http.get('/api/admin/mots-de-passe').set(auth(admin))).body.demandes.find((x: any) => x.id === d.id);
    expect(apres).toMatchObject({ statut: 'UTILISEE', user: { identifiant: ident } });
    // la clé API ne peut toujours pas accéder aux autres routes d'administration
    expect((await http.get('/api/admin/fiches').set('X-Api-Key', cle)).status).toBe(403);
  });
});

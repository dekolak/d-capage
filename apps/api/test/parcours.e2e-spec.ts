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
  });

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

    // --- accord photos : filtre admin « photos utilisables » ---
    const sans = (await http.get('/api/admin/fiches?photosUtilisables=oui&parPage=50').set(auth(admin))).body;
    expect(sans.fiches.some((x: any) => x.id === fiche)).toBe(false);
    expect((await http.patch(`/api/fiches/${fiche}`).set(auth(alice)).send({ accordPhotos: true })).body.accordPhotos).toBe(true);
    const avec = (await http.get('/api/admin/fiches?photosUtilisables=oui&parPage=50').set(auth(admin))).body;
    expect(avec.fiches.some((x: any) => x.id === fiche)).toBe(true);

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
});

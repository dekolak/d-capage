/**
 * Parcours complet sur une vraie base (DATABASE_URL de .env, seed déjà lancé) :
 * comptes, machines, fiche, validation, photos, communauté, notes, duplication.
 */
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
});

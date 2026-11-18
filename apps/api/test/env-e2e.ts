// Les tests font beaucoup de connexions depuis la même adresse : limites par IP relevées (testées dans limiteur.spec.ts).
process.env.LIMITE_CONNEXION_IP = '10000';
process.env.LIMITE_DEMANDES_IP = '10000';
process.env.LIMITE_CODE_IP = '10000';

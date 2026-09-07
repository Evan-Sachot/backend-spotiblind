# Spoti-Blind — Backend

API REST et serveur temps réel du blindtest multijoueur **Spoti-Blind** : les joueurs devinent des musiques tirées de leurs propres playlists Spotify, puis votent pour deviner à qui appartenait chaque morceau.

> Dépôt frontend associé : `frontend-spotiblind`

## Stack technique

- **Node.js / Express** — API REST (authentification, playlists, recherche)
- **Socket.io** — temps réel (salons, boucle de jeu), événements typés par un contrat partagé avec le front
- **TypeScript** (modules ES) — exécution en développement via `tsx`
- **MySQL** — persistance des utilisateurs, jetons Spotify chiffrés en AES-256
- **API Spotify** (OAuth 2.0) — profils, playlists, recherche de titres
- **API iTunes Search** — extraits audio de 30 secondes
- **Vitest** — tests unitaires
- **Docker** — conteneurisation (voir la section dédiée)

## Prérequis

- Node.js 20 ou supérieur, et npm
- MySQL (installation locale ou conteneur)
- Un compte Spotify **Premium** (exigence Spotify pour le propriétaire d'une application)
- Une application déclarée sur [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) :
  - **Redirect URI** : `http://127.0.0.1:5000/api/spotify/callback` (au caractère près)
  - **Web API** cochée dans les API utilisées
  - **User Management** : ajouter l'adresse e-mail de chaque compte de test (5 maximum en mode Développement)

## Installation

```bash
git clone <url-du-depot>
cd backend-spotiblind
npm install
```

### Base de données

Créer la base `blindtest_db`, puis importer le schéma :

```bash
mysql -u root -p blindtest_db < database/blindtest_db.sql
```

Le script ne contient que la structure, aucune donnée. Il sert aussi bien à l'installation initiale qu'à une restauration après incident.

### Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs :

| Variable | Description |
|---|---|
| `PORT` | Port d'écoute du serveur (5000) |
| `FRONTEND_URL` | URL du front, pour le CORS et les redirections OAuth |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Connexion MySQL |
| `JWT_SECRET` | Clé de signature des jetons |
| `ENCRYPTION_KEY` | Clé AES-256, **exactement 32 caractères** |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Identifiants de l'application Spotify |
| `SPOTIFY_REDIRECT_URI` | Identique à celle déclarée sur le dashboard |

Génération des secrets :

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ENCRYPTION_KEY (32 caracteres)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> Le serveur refuse de démarrer si un secret est absent : aucune valeur de repli n'est prévue, par choix de sécurité.

## Lancement

```bash
npm run dev      # développement, rechargement automatique
npm run build    # compilation TypeScript vers ./dist
npm start        # exécution du code compilé
npm test         # tests unitaires
```

Démarrage attendu : `Server is running on port 5000` puis `Connected to the database`.

## Conteneurisation

Le dépôt contient un `Dockerfile` en deux étapes : compilation TypeScript, puis image finale ne contenant que le code compilé et les dépendances de production, exécutée par un utilisateur non privilégié.

L'orchestration des trois services (base de données, back, front) est décrite dans le `docker-compose.yml` placé dans le dossier parent des deux dépôts. Depuis ce dossier :

```bash
docker compose up --build    # construction et démarrage
docker compose ps            # état des conteneurs
docker compose logs -f back  # logs du serveur
docker compose down          # arrêt
```

Dans ce contexte, les variables d'environnement sont injectées par le compose et non lues depuis un fichier `.env` de l'image. La base est jointe par le nom du service (`db`) et non par `localhost`.

## Architecture

```
src/
├── controllers/   Adaptation HTTP vers le métier
├── errors/        Classe d'erreur applicative
├── middlewares/   Vérification du JWT sur les routes protégées
├── models/        Accès MySQL en requêtes préparées
├── routes/        Déclaration des points d'entrée REST
├── services/      Métier : game, spotify, itunes, auth
├── sockets/       Temps réel : authentification, salons, partie
├── types/         Contrats TypeScript, dont socket.types (miroir du front)
├── utils/         Fonctions pures : chiffrement, normalisation de titres
└── config/        Pool de connexions MySQL
```

Principes structurants :
- **Le serveur est l'arbitre** : phases, chronomètres, validation des réponses et scores sont calculés exclusivement côté serveur. Aucune donnée de réponse n'est transmise au client avant sa révélation.
- **Contrat typé** : `src/types/socket.types.ts` est dupliqué à l'identique côté front ; toute divergence d'événement ou de payload devient une erreur de compilation.
- **Validation tolérante des réponses** : comparaison par titre et artiste normalisés (`utils/text.util.ts`, couvert par 18 tests unitaires), afin d'accepter les différentes éditions d'une même chanson.

## Limites connues

- **Mode Développement Spotify** : 5 utilisateurs déclarés au maximum ; une ouverture au public nécessiterait une demande d'*Extended Quota*.
- **Politique développeur Spotify** : les applications de jeu et de quiz ne sont pas autorisées par les conditions d'utilisation. Le projet reste un démonstrateur technique privé ; une publication supposerait de remplacer Spotify par un autre fournisseur de données musicales.
- Les playlists éditoriales de Spotify (Daily Mix, Top 50…) sont inaccessibles aux applications récentes : seules les playlists créées par les joueurs sont utilisables.
- L'état des parties résidant en mémoire, une seule instance du serveur est possible ; une montée en charge imposerait de l'externaliser.
- Lors d'une reconnexion en cours de manche, l'affichage se resynchronise à la manche suivante.

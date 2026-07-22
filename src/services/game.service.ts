// ============================================================
// GAME SERVICE — Le cerveau de la partie (logique métier pure)
// Le handler écoute, le service calcule et pilote la boucle.
// ============================================================
import { GameState, BlindTestTrack, PublicPlayer } from "../types/game.types.js";
import { TypedServer } from "../types/socket.types.js";
import userModel from "../models/user.model.js";
import spotifyService from "./spotify.service.js";
import itunesService from "./itunes.service.js";
import { isSameSong } from "../utils/text.util.js";

// --- CONSTANTES DE JEU (valeurs par défaut si l'hôte ne règle rien) ---
export const DEFAULT_MAX_ROUNDS = 10;
export const DEFAULT_GUESS_TIME = 30; // secondes pour deviner la musique
export const OWNER_GUESS_TIME = 15; // secondes pour voter le propriétaire
const NEXT_ROUND_DELAY = 5000; // pause (ms) entre deux manches
// Combien de pistes candidates on résout via iTunes par manche voulue :
// x3 pour compenser celles sans extrait, sans spammer l'API iTunes
const CANDIDATE_FACTOR = 3;

// ------------------------------------------------------------
// HELPER : transforme le Record players en tableau "public"
// prêt à être envoyé au front (utilisé par TOUS les emit).
// ------------------------------------------------------------
const getPublicPlayers = (currentGame: GameState): PublicPlayer[] => {
  return Object.entries(currentGame.players).map(([idStr, info]) => ({
    id: Number(idStr),
    username: info.username,
    score: info.score,
  }));
};

// ------------------------------------------------------------
// ÉTAPE 1 : PRÉPARATION DES PISTES
// Récupère les playlists de chaque joueur, fusionne, dédoublonne
// (en cumulant les ownerIds), mélange (Fisher-Yates) et découpe.
// ------------------------------------------------------------
const prepareTracks = async (
  playlists: Record<number, string>,
  maxRounds: number,
): Promise<BlindTestTrack[]> => {
  const trackPromises: Promise<BlindTestTrack[]>[] = [];

  // Une promesse par joueur : récupération parallèle des playlists
  for (const [userIdStr, playlistId] of Object.entries(playlists)) {
    const userId = Number(userIdStr);

    const tokens = await userModel.getSpotifyToken(userId);
    if (tokens) {
      const promise = spotifyService
        .getPlaylistTrack(userId, tokens.access_token, playlistId)
        .then((tracks) =>
          tracks.map((track) => ({
            ...track,
            ownerIds: [userId], // chaque piste est taguée avec son propriétaire
          })),
        );
      trackPromises.push(promise);
    }
  }

  const trackByPlaylist = await Promise.all(trackPromises);
  const allTracks = trackByPlaylist.flat();

  // Dédoublonnage : si 2 joueurs ont la même musique,
  // on garde UNE piste avec les DEUX propriétaires
  const trackMap: Record<string, BlindTestTrack> = {};
  for (const track of allTracks) {
    if (trackMap[track.id]) {
      const existingTrack = trackMap[track.id];
      if (!existingTrack.ownerIds.includes(track.ownerIds[0])) {
        existingTrack.ownerIds.push(track.ownerIds[0]);
      }
    } else {
      trackMap[track.id] = track;
    }
  }
  const uniqueTracks = Object.values(trackMap);

  // Mélange de Fisher-Yates (vrai aléatoire uniforme)
  for (let i = uniqueTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
  }

  // --- RÉSOLUTION DES EXTRAITS AUDIO (iTunes) ---
  // Spotify ne fournit plus de preview_url aux apps récentes.
  // On ne résout que les candidats nécessaires (maxRounds x 3),
  // APRÈS le mélange, pour limiter les appels à l'API iTunes.
  const candidates = uniqueTracks.slice(0, maxRounds * CANDIDATE_FACTOR);

  const resolvedTracks = await Promise.all(
    candidates.map(async (track) => {
      // Si Spotify a (encore) fourni un extrait, on le garde tel quel
      if (track.previewUrl) return track;
      // Sinon on cherche l'extrait équivalent chez iTunes
      const previewUrl = await itunesService.searchPreviewUrl(
        track.title,
        track.artist,
      );
      return previewUrl ? { ...track, previewUrl } : null; // null = piste injouable
    }),
  );

  // On écarte les pistes sans extrait, puis on limite au nombre de manches
  const playableTracks = resolvedTracks.filter(
    (track): track is BlindTestTrack => track !== null,
  );

  console.log(
    `Préparation : ${playableTracks.length} pistes jouables sur ${candidates.length} candidates (${uniqueTracks.length} au total)`,
  );

  return playableTracks.slice(0, maxRounds);
};

// ------------------------------------------------------------
// ÉTAPE 2 : LANCEMENT D'UNE MANCHE (phase GUESS_SONG)
// Envoie l'extrait audio + la durée, puis arme le chrono serveur.
// ------------------------------------------------------------
const startNewRound = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_SONG";

  // Remise à zéro des données de la manche précédente
  currentGame.roundCorrectPlayers = {};
  currentGame.roundOwnerGuesses = {};

  const nextTrack = currentGame.tracks[currentGame.currentTrack];
  // Durée réglée par l'hôte, sinon valeur par défaut
  const guessTime = currentGame.guessTime ?? DEFAULT_GUESS_TIME;

  // ANTI-TRICHE : on n'envoie QUE l'audio et les infos d'affichage,
  // jamais le titre/artiste pendant cette phase
  io.to(roomCode).emit("newTrack", {
    previewUrl: nextTrack.previewUrl,
    currentRound: currentGame.currentTrack + 1, // +1 pour l'affichage humain (Round 1, 2...)
    totalRounds: currentGame.tracks.length,
    duration: guessTime, // le front décompte localement à partir de cette valeur
  });

  // CHRONO SERVEUR (l'arbitre) : fin de phase automatique
  setTimeout(() => {
    // Sécurité : la partie existe-t-elle encore et est-on toujours dans la bonne phase ?
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_SONG") {
      startOwnerGuessPhase(io, roomCode, currentGame, activeGames);
    }
  }, guessTime * 1000);
};

// ------------------------------------------------------------
// ÉTAPE 3 : PHASE DE VOTE (GUESS_OWNER)
// On révèle la réponse et on ouvre les votes pendant 15 secondes.
// ------------------------------------------------------------
const startOwnerGuessPhase = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  currentGame.phase = "GUESS_OWNER";
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  io.to(roomCode).emit("songPhaseEnded", {
    title: currentTrack.title,
    artist: currentTrack.artist,
    duration: OWNER_GUESS_TIME,
  });

  setTimeout(() => {
    if (activeGames.has(roomCode) && currentGame.phase === "GUESS_OWNER") {
      endRoundAndNext(io, roomCode, currentGame, activeGames);
    }
  }, OWNER_GUESS_TIME * 1000);
};

// ------------------------------------------------------------
// ÉTAPE 4 : FIN DE MANCHE
// Calcul des bonus propriétaire, bilan, puis manche suivante
// ou fin de partie (SCOREBOARD).
// ------------------------------------------------------------
const endRoundAndNext = (
  io: TypedServer,
  roomCode: string,
  currentGame: GameState,
  activeGames: Map<string, GameState>,
) => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  // +5 points pour chaque joueur ayant voté un des vrais propriétaires
  if (currentGame.roundOwnerGuesses) {
    for (const [playerIdStr, guessedOwnerId] of Object.entries(
      currentGame.roundOwnerGuesses,
    )) {
      const playerId = Number(playerIdStr);
      const player = currentGame.players[playerId];
      // Le joueur peut avoir quitté entre-temps : on vérifie qu'il existe encore
      if (player && currentTrack.ownerIds.includes(guessedOwnerId)) {
        player.score += 5;
      }
    }
  }

  // Bilan de la manche : les vrais propriétaires + les scores à jour (avec usernames)
  io.to(roomCode).emit("roundSummary", {
    ownerIds: currentTrack.ownerIds,
    players: getPublicPlayers(currentGame),
  });

  currentGame.currentTrack++;

  if (currentGame.currentTrack >= currentGame.tracks.length) {
    // Plus de pistes : fin de partie
    currentGame.phase = "SCOREBOARD";
    io.to(roomCode).emit("gameOver", { players: getPublicPlayers(currentGame) });
  } else {
    // Pause de 5s pour lire les scores, puis manche suivante
    setTimeout(() => {
      if (activeGames.has(roomCode)) {
        startNewRound(io, roomCode, currentGame, activeGames);
      }
    }, NEXT_ROUND_DELAY);
  }
};

// ------------------------------------------------------------
// LOGIQUE DE RÉPONSE : deviner la musique (+10 points)
// Double vérification :
// 1. ID identique (cas simple : même édition Spotify)
// 2. OU titre+artiste normalisés identiques (cas fréquent : le
//    joueur a cliqué la bonne chanson dans l'auto-complétion,
//    mais sous un AUTRE ID — single vs album vs remaster).
// Sans le 2e critère, une bonne réponse était comptée fausse.
// ------------------------------------------------------------
const processSongGuess = (
  currentGame: GameState,
  userId: number,
  guess: { trackId: string; title: string; artist: string },
): boolean => {
  const currentTrack = currentGame.tracks[currentGame.currentTrack];

  const isCorrect =
    guess.trackId === currentTrack.id ||
    isSameSong(guess, currentTrack);

  if (isCorrect) {
    if (!currentGame.roundCorrectPlayers) currentGame.roundCorrectPlayers = {};
    // Anti double-points : si le joueur a déjà trouvé cette manche, on ignore
    if (currentGame.roundCorrectPlayers[userId]) return false;

    currentGame.roundCorrectPlayers[userId] = true;

    const player = currentGame.players[userId];
    if (player) player.score += 10;
    return true;
  }
  return false;
};

// ------------------------------------------------------------
// LOGIQUE DE RÉPONSE : voter le propriétaire
// Le vote est enregistré (et modifiable) jusqu'à la fin du chrono ;
// les points sont calculés dans endRoundAndNext.
// ------------------------------------------------------------
const processOwnerGuess = (
  currentGame: GameState,
  userId: number,
  guessedOwnerId: number,
): boolean => {
  if (!currentGame.roundOwnerGuesses) currentGame.roundOwnerGuesses = {};
  currentGame.roundOwnerGuesses[userId] = guessedOwnerId;
  return true;
};

// ------------------------------------------------------------
// RETOUR AU LOBBY (bouton "Rejouer" de l'hôte)
// ------------------------------------------------------------
const resetGameToLobby = (currentGame: GameState) => {
  currentGame.phase = "LOBBY";
  currentGame.tracks = [];
  currentGame.currentTrack = 0;
  currentGame.playlists = {};

  // On remet tous les scores à zéro en gardant les joueurs
  for (const playerIdStr of Object.keys(currentGame.players)) {
    currentGame.players[Number(playerIdStr)].score = 0;
  }
};

export default {
  prepareTracks,
  startNewRound,
  processSongGuess,
  processOwnerGuess,
  resetGameToLobby,
  getPublicPlayers, // exporté : utilisé aussi par room.handler pour les payloads
};
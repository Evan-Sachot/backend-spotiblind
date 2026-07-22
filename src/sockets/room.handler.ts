// ============================================================
// ROOM HANDLER — Gestion des salons (création, join, leave,
// reconnexion, déconnexions sauvages avec grâce de 15s)
// ============================================================
import { GameState } from "../types/game.types.js";
import { TypedServer, AuthenticateSocket } from "../types/socket.types.js";
import gameService from "../services/game.service.js";

const DISCONNECT_GRACE_MS = 15000; // délai avant d'exclure un joueur qui a perdu la connexion

// Génère un code de salon à 6 caractères alphanumériques (ex: 8537C4)
const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const handleRoomEvents = (
  io: TypedServer,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>, // index rapide : userId -> roomCode
  activeGames: Map<string, GameState>, // état complet : roomCode -> GameState
) => {
  const user = socket.data.user;

  // ------------------------------------------------------------
  // FERMETURE COMPLÈTE D'UN SALON (factorisée : utilisée quand
  // l'hôte part volontairement OU perd la connexion)
  // ------------------------------------------------------------
  const closeRoom = (roomCode: string, currentGame: GameState, message: string) => {
    io.to(roomCode).emit("roomClosed", { message });

    // On nettoie l'index de TOUS les joueurs du salon
    for (const playerIdStr of Object.keys(currentGame.players)) {
      activePlayers.delete(Number(playerIdStr));
    }
    activeGames.delete(roomCode);
    // On force tous les sockets à quitter la room Socket.io
    io.in(roomCode).socketsLeave(roomCode);
  };

  // ------------------------------------------------------------
  // RECONNEXION AUTOMATIQUE
  // Si le joueur était déjà dans un salon (rafraîchissement de
  // page pendant la grâce de 15s), on le raccroche à sa room.
  // ------------------------------------------------------------
  if (activePlayers.has(user.id)) {
    const previousRoom = activePlayers.get(user.id) as string;
    const previousGame = activeGames.get(previousRoom);

    if (previousGame) {
      socket.join(previousRoom);
      console.log(`${user.username} reconnecté au salon ${previousRoom}`);

      // ANTI-TRICHE : on n'envoie JAMAIS previousGame entier
      // (il contient tracks[] avec les réponses). Version filtrée :
      socket.emit("roomRejoined", {
        roomCode: previousRoom,
        phase: previousGame.phase,
        players: gameService.getPublicPlayers(previousGame),
        roomHost: previousGame.roomHost,
      });
    }
  }

  // ------------------------------------------------------------
  // CRÉATION D'UN SALON
  // ------------------------------------------------------------
  socket.on("createRoom", () => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    activePlayers.set(user.id, roomCode);

    // État initial : le créateur est hôte et premier joueur
    const initialGameState: GameState = {
      roomHost: user.username,
      code: roomCode,
      phase: "LOBBY",
      tracks: [],
      currentTrack: 0,
      players: { [user.id]: { username: user.username, score: 0 } },
    };
    activeGames.set(roomCode, initialGameState);

    console.log(`Salon ${roomCode} créé par ${user.username}`);

    // CONTRAT : objet { roomCode, players, roomHost }, plus une string nue
    socket.emit("roomCreated", {
      roomCode: roomCode,
      players: gameService.getPublicPlayers(initialGameState),
      roomHost: user.username,
    });
  });

  // ------------------------------------------------------------
  // REJOINDRE UN SALON
  // ------------------------------------------------------------
  socket.on("joinRoom", (roomCode: string) => {
    const currentGame = activeGames.get(roomCode);

    // Salon inexistant : on PRÉVIENT le front (avant, simple console.log)
    if (!currentGame) {
      return socket.emit("error", { message: "Ce salon n'existe pas." });
    }
    // On ne rejoint pas une partie déjà lancée
    if (currentGame.phase !== "LOBBY") {
      return socket.emit("error", { message: "La partie a déjà commencé." });
    }

    socket.join(roomCode);
    activePlayers.set(user.id, roomCode);
    currentGame.players[user.id] = { username: user.username, score: 0 };

    console.log(`${user.username} a rejoint le salon ${roomCode}`);

    const players = gameService.getPublicPlayers(currentGame);

    // Confirmation au nouveau venu (avec la liste complète pour peupler son lobby)
    socket.emit("roomJoined", {
      roomCode,
      players,
      roomHost: currentGame.roomHost,
    });

    // roomUpdated aux AUTRES : la liste complète + un message d'info
    socket.to(roomCode).emit("roomUpdated", {
      players,
      roomHost: currentGame.roomHost,
      message: `${user.username} a rejoint le salon !`,
    });
  });

  // ------------------------------------------------------------
  // QUITTER VOLONTAIREMENT (bouton "Quitter")
  // ------------------------------------------------------------
  socket.on("leaveRoom", () => {
    const currentRoom = activePlayers.get(user.id);
    if (!currentRoom) return;

    const currentGame = activeGames.get(currentRoom);
    if (currentGame) {
      // Si l'HÔTE part : le salon ferme pour tout le monde
      if (currentGame.roomHost === user.username) {
        console.log(`L'hôte ${user.username} a fermé le salon ${currentRoom}`);
        closeRoom(
          currentRoom,
          currentGame,
          `L'hôte ${user.username} a fermé le salon.`,
        );
        return;
      }

      // Joueur normal : on le retire de la partie
      delete currentGame.players[user.id];

      // Salon vide -> destruction (évite les fuites mémoire serveur)
      if (Object.keys(currentGame.players).length === 0) {
        activeGames.delete(currentRoom);
        console.log(`Salon ${currentRoom} vide, suppression.`);
      } else {
        // On prévient les restants avec la liste à jour
        socket.to(currentRoom).emit("roomUpdated", {
          players: gameService.getPublicPlayers(currentGame),
          roomHost: currentGame.roomHost,
          message: `${user.username} a quitté le salon.`,
        });
      }
    }

    socket.leave(currentRoom);
    activePlayers.delete(user.id);
    console.log(`${user.username} a quitté le salon ${currentRoom}`);
  });

  // ------------------------------------------------------------
  // DÉCONNEXION SAUVAGE (fermeture d'onglet, crash, wifi...)
  // Grâce de 15s : si le joueur revient (reconnexion auto en haut
  // de ce fichier), rien ne se passe. Sinon on l'exclut proprement.
  // ------------------------------------------------------------
  socket.on("disconnect", () => {
    const currentRoom = activePlayers.get(user.id);
    if (!currentRoom) return;

    console.log(`${user.username} a perdu la connexion. Grâce de 15s...`);

    // On informe le salon (la liste ne change pas encore : le joueur peut revenir)
    const gameNow = activeGames.get(currentRoom);
    if (gameNow) {
      socket.to(currentRoom).emit("roomUpdated", {
        players: gameService.getPublicPlayers(gameNow),
        roomHost: gameNow.roomHost,
        message: `${user.username} a perdu la connexion...`,
      });
    }

    setTimeout(() => {
      // Le joueur est-il toujours "officiellement" dans ce salon
      // sans s'être reconnecté ? (s'il est revenu, un nouveau socket
      // a rejoint la room, mais activePlayers pointe toujours ici :
      // on vérifie donc s'il existe un socket actif pour lui)
      const isStillRegistered = activePlayers.get(user.id) === currentRoom;
      const currentGame = activeGames.get(currentRoom);
      if (!currentGame || !isStillRegistered) return;

      // A-t-il un socket vivant dans la room ? (reconnexion réussie)
      const socketsInRoom = io.sockets.adapter.rooms.get(currentRoom);
      let hasReconnected = false;
      if (socketsInRoom) {
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.data.user.id === user.id) {
            hasReconnected = true;
            break;
          }
        }
      }
      if (hasReconnected) return; // il est revenu à temps, on ne fait rien

      // --- Le joueur ne s'est PAS reconnecté ---
      if (currentGame.roomHost === user.username) {
        console.log(
          `Hôte ${user.username} définitivement déconnecté : fermeture de ${currentRoom}.`,
        );
        closeRoom(
          currentRoom,
          currentGame,
          "Connexion perdue avec l'hôte. Le salon est fermé.",
        );
        return;
      }

      console.log(`${user.username} ne s'est pas reconnecté à temps.`);
      delete currentGame.players[user.id];
      activePlayers.delete(user.id);

      if (Object.keys(currentGame.players).length === 0) {
        activeGames.delete(currentRoom);
      } else {
        io.to(currentRoom).emit("roomUpdated", {
          players: gameService.getPublicPlayers(currentGame),
          roomHost: currentGame.roomHost,
          message: `${user.username} a été déconnecté.`,
        });
      }
    }, DISCONNECT_GRACE_MS);
  });
};
import { Server } from "socket.io";
import { AuthenticateSocket } from "../types/socket.types.js";
import { GameState, BlindTestTrack } from "../types/game.types.js";
import authService from "../services/auth.service.js";
import userModel from "../models/user.model.js";
import spotifyService from "../services/spotify.service.js";

export const handleGameEvents = (
  io: Server,
  socket: AuthenticateSocket,
  activePlayers: Map<number, string>,
  activeGames: Map<string, GameState>,
) => {
  const user = socket.data.user;
  socket.on("selectPlaylist", (playlistId: string) => {
    const roomCode = activePlayers.get(user.id);
    if (!roomCode) return;

    const currentGame = activeGames.get(roomCode);

    if (currentGame && currentGame.phase === "LOBBY") {
      if (!currentGame.playlists) {
        currentGame.playlists = {};
      }
      currentGame.playlists[user.id] = playlistId;
      console.log(`${user.username} a choisi une playlist salon${roomCode}`);

      io.to(roomCode).emit("playerSelectedPlaylist", {
        userId: user.id,
        playlistId: playlistId,
      });
    }
  });

  socket.on("setMaxRounds", (rounds: number) => {
    const roomCode = activePlayers.get(user.id);
    if(!roomCode) return
    const currentGame = activeGames.get(roomCode);
    if (currentGame && currentGame.roomHost === user.username) {
      currentGame.maxRounds = rounds;
      console.log(`L'hôte ${user.username} a fixé la limite à ${rounds} manches.`);
      io.to(roomCode).emit("maxRoundsSet", rounds);
    
    }
})

 socket.on("startGame", async()=>{
  const roomCode = activePlayers.get(user.id);
  if(!roomCode) return
  const currentGame:any=activeGames.get(roomCode);
  if(!currentGame || currentGame.roomHost != user.username)return

  try{
    console.log(`Lancement de la partie host ${currentGame.roomHost} du salon ${currentGame.code}`)
    if(!currentGame.playlists|| Object.keys(currentGame.playlists).length===0){
      socket.emit("gameError",{message:"Aucune playlist sélectionnée "})
      return
    }
    const trackPromises:Promise<BlindTestTrack[]>[]=[];

    for(const[userIdStr,playlistId]of Object.entries(currentGame.playlists)){
      const userId = Number(userIdStr);

      const tokens = await userModel.getSpotifyToken(userId);

      if(tokens){
        const promise = spotifyService.getPlaylistTrack(
          userId,
          tokens.access_token,
          playlistId as string
        )
       .then((tracks) => 
        tracks.map((track) => ({
          ...track,
          ownerId: userId
        }))
      );

      trackPromises.push(promise);
    }
    }
    const tracksByPlaylist = await Promise.all(trackPromises);
    let allTracks = tracksByPlaylist.flat();

    if(allTracks.length===0){
      return socket.emit("gameError",{message:"playlists vides"});
    }
    for (let i = allTracks.length -1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
     [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
    }
    if (currentGame.maxRounds) {
        allTracks = allTracks.slice(0, currentGame.maxRounds);
      }

      currentGame.tracks = allTracks;
      currentGame.currentTrack=0;
      currentGame.phase="GUESS_SONG";
      delete currentGame.playlists;

      const sanitizedGameState={
        code:currentGame.code,
        roomHost:currentGame.roomHost,
        phase:currentGame.phase,
        totalTracks:currentGame.tracks.length
      };

      io.to(roomCode).emit("gameStarted",sanitizedGameState);

      setTimeout(()=>{
        const firstTrack = currentGame.tracks[currentGame.currentTrack];
        io.to(roomCode).emit("newTrack",{
          previewUrl:firstTrack.previewUrl
        });
      },3000)

  }catch(error){
    console.error("Erreur au lancement de la partie", error);
    socket.emit("gameError",{
      message:"Impossible de lancer la partie. Problème de récupération des musiques. "
    })
  }
 })


}
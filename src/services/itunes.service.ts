// ============================================================
// ITUNES SERVICE — Résolution des extraits audio 30 secondes.
//
// POURQUOI : l'API Spotify ne fournit plus de preview_url aux
// apps récentes. iTunes Search (gratuite, sans clé) prend le relais.
//
// V2 — MATCHING VALIDÉ : prendre "le premier résultat avec un
// extrait" renvoyait parfois une reprise, un karaoké ou un
// homonyme. Désormais chaque candidat iTunes est VÉRIFIÉ :
// son titre ET son artiste (normalisés) doivent correspondre
// aux métadonnées Spotify. Aucun match validé = piste écartée
// (mieux vaut une manche en moins qu'un mauvais son).
// ============================================================
import axios from "axios";
// normalize/matches vivent désormais dans un util partagé :
// game.service en a aussi besoin pour vérifier les réponses
import { normalize, matches } from "../utils/text.util.js";

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

// ------------------------------------------------------------
// Cherche l'extrait 30s d'un morceau. Retourne null si aucun
// résultat iTunes ne correspond VRAIMENT au titre + artiste.
// ------------------------------------------------------------
const searchPreviewUrl = async (
  title: string,
  artist: string,
): Promise<string | null> => {
  try {
    const params = new URLSearchParams({
      term: `${artist} ${title}`,
      media: "music",
      entity: "song",
      limit: "5", // assez de candidats pour trouver LE bon
      country: "FR",
    });

    const response = await axios.get(
      `${ITUNES_SEARCH_URL}?${params.toString()}`,
    );
    const results = response.data?.results ?? [];

    const wantedTitle = normalize(title);
    const wantedArtist = normalize(artist);

    // On cherche le premier candidat qui a un extrait ET dont
    // le titre ET l'artiste correspondent aux données Spotify
    const validMatch = results.find((r: any) => {
      if (!r.previewUrl) return false;
      return (
        matches(normalize(r.trackName ?? ""), wantedTitle) &&
        matches(normalize(r.artistName ?? ""), wantedArtist)
      );
    });

    if (!validMatch) {
      console.log(`iTunes : aucun match fiable pour "${title}" - ${artist}`);
      return null;
    }

    return validMatch.previewUrl;
  } catch (error) {
    // Un échec iTunes ne doit JAMAIS faire planter la préparation
    // de la partie : on écarte simplement cette piste
    console.error(`iTunes : erreur de recherche pour "${title}" - ${artist}`);
    return null;
  }
};

export default { searchPreviewUrl };
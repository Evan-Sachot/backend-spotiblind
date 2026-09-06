import axios from "axios";
import { normalize, matches } from "../utils/text.util.js";

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

// CHERCHE EXTRAIT ITUNES POUR UNE MUSIQUE RENVOIE NULL SI AUCUN MATCH FIABLE
const searchPreviewUrl = async (
  title: string,
  artist: string,
): Promise<string | null> => {
  try {
    const params = new URLSearchParams({
      term: `${artist} ${title}`,
      media: "music",
      entity: "song",
      limit: "5", 
      country: "FR",
    });

    const response = await axios.get(
      `${ITUNES_SEARCH_URL}?${params.toString()}`,
    );
    const results = response.data?.results ?? [];

    const wantedTitle = normalize(title);
    const wantedArtist = normalize(artist);
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
    console.error(`iTunes : erreur de recherche pour "${title}" - ${artist}`);
    return null;
  }
};

export default { searchPreviewUrl };
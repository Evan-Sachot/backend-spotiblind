// ============================================================
// TEXT UTIL — Normalisation et comparaison de titres/artistes.
// Utilisé par :
// - itunes.service : matcher une piste Spotify avec son extrait iTunes
// - game.service : vérifier la réponse d'un joueur (processSongGuess)
//
// Pourquoi c'est nécessaire : la même chanson existe sous des
// formes différentes selon le catalogue et l'édition —
// "Étoile Filante (feat. Nekfeu) - Remastered 2019" et
// "Etoile filante" sont LE MÊME morceau. Comparer les chaînes
// brutes (ou les IDs Spotify, qui changent entre single/album)
// produirait des faux négatifs.
// ============================================================

// ------------------------------------------------------------
// NORMALISATION : rend deux chaînes comparables.
// Étapes : minuscules -> suppression des accents (décomposition
// Unicode NFD) -> suppression des parenthèses/crochets (feat,
// remix...) -> coupe tout ce qui suit " - " (Remastered, Radio
// Edit...) -> ponctuation en espaces -> espaces multiples réduits.
// ------------------------------------------------------------
export const normalize = (raw: string): string => {
  return raw
    .toLowerCase()
    .normalize("NFD") 
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/\(.*?\)|\[.*?\]/g, "") // (feat.X), [Remix]
    .split(" - ")[0] // retire "- Remastered 2019".
    .replace(/[^a-z0-9 ]/g, " ") // ponctuation en espaces
    .replace(/\s+/g, " ") // espaces multiples réduits à un seul
    .trim();
};

// ------------------------------------------------------------
// Deux chaînes normalisées "correspondent" si l'une contient
// l'autre : tolère "Jay Z" vs "Jay Z feat Beyonce", ou un titre
// légèrement raccourci d'un catalogue à l'autre.
// ------------------------------------------------------------
export const matches = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

// ------------------------------------------------------------
// LA règle métier du blindtest : deux morceaux sont "la même
// chanson" si leurs titres normalisés correspondent ET leurs
// artistes normalisés correspondent.
// ------------------------------------------------------------
export const isSameSong = (
  a: { title: string; artist: string },
  b: { title: string; artist: string },
): boolean => {
  return (
    matches(normalize(a.title), normalize(b.title)) &&
    matches(normalize(a.artist), normalize(b.artist))
  );
};
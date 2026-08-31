// ============================================================
// TESTS UNITAIRES — text.util (normalize, matches, isSameSong)
//
// Pourquoi CE module est testé en priorité : ce sont des
// fonctions PURES (mêmes entrées -> mêmes sorties, zéro
// dépendance externe), et elles portent deux règles métier
// critiques du jeu : le matching des extraits iTunes et la
// validation des réponses des joueurs. Un bug ici = des points
// injustement refusés ou de mauvais extraits audio.
//
// Chaque cas de test correspond à un problème RÉEL rencontré
// pendant le développement (accents, feat., remaster, éditions
// multiples d'une même chanson).
//
// Lancer : npm test (une passe) ou npm run test:watch
// ============================================================
import { describe, it, expect } from "vitest";
import { normalize, matches, isSameSong } from "./text.util.js";

//nettoyage 
describe("normalize", () => {
  it("passe en minuscules", () => {
    expect(normalize("HUMBLE.")).toBe("humble");
  });

  it("supprime les accents (décomposition Unicode)", () => {
    expect(normalize("Étoile Filante")).toBe("etoile filante");
    expect(normalize("Ça plane pour moi")).toBe("ca plane pour moi");
  });

  it("supprime les mentions entre parenthèses (feat, version...)", () => {
    expect(normalize("Étoile Filante (feat. Nekfeu) - Remastered 2019")).toBe(
      "etoile filante",
    );
  });

  it("supprime les mentions entre crochets", () => {
    expect(normalize("Bohemian Rhapsody [Live Aid]")).toBe("bohemian rhapsody");
  });

  it("coupe les suffixes après ' - ' (Remastered, bandes originales...)", () => {
    expect(normalize('Lose Yourself - From "8 Mile" Soundtrack')).toBe(
      "lose yourself",
    );
  });

  it("ne coupe PAS les tirets à l'intérieur d'un mot", () => {
    expect(normalize("T-Shirt")).toBe("t shirt");
  });

  it("remplace la ponctuation et réduit les espaces multiples", () => {
    expect(normalize("m.A.A.d city")).toBe("m a a d city");
    expect(normalize("  Espaces   multiples  ")).toBe("espaces multiples");
  });

  it("renvoie une chaîne vide pour une entrée vide", () => {
    expect(normalize("")).toBe("");
  });
});

describe("matches", () => {
  it("accepte l'égalité stricte", () => {
    expect(matches("nirvana", "nirvana")).toBe(true);
  });

  it("accepte l'inclusion dans les deux sens", () => {
    expect(matches("jay z", "jay z feat beyonce")).toBe(true);
    expect(matches("jay z feat beyonce", "jay z")).toBe(true);
  });

  it("refuse deux chaînes sans lien", () => {
    expect(matches("nirvana", "queen")).toBe(false);
  });

  it("refuse si l'une des chaînes est vide (jamais de match par défaut)", () => {
    expect(matches("", "nirvana")).toBe(false);
    expect(matches("nirvana", "")).toBe(false);
    expect(matches("", "")).toBe(false);
  });
});

//validation des reponses
describe("isSameSong", () => {
  it("valide la même chanson à l'identique", () => {
    expect(
      isSameSong(
        { title: "Bohemian Rhapsody", artist: "Queen" },
        { title: "Bohemian Rhapsody", artist: "Queen" },
      ),
    ).toBe(true);
  });

  it("valide deux ÉDITIONS de la même chanson ", () => {
    expect(
      isSameSong(
        { title: "Bohemian Rhapsody - Remastered 2011", artist: "Queen" },
        { title: "Bohemian Rhapsody", artist: "Queen" },
      ),
    ).toBe(true);
  });

  it("valide malgré une mention feat. absente d'un côté", () => {
    expect(
      isSameSong(
        { title: "Étoile Filante (feat. Nekfeu)", artist: "Orelsan" },
        { title: "Etoile filante", artist: "Orelsan" },
      ),
    ).toBe(true);
  });

  it("refuse le même titre par un AUTRE artiste (reprise/homonyme)", () => {
    expect(
      isSameSong(
        { title: "Hello", artist: "Adele" },
        { title: "Hello", artist: "Martin Solveig" },
      ),
    ).toBe(false);
  });

  it("refuse un autre titre du même artiste", () => {
    expect(
      isSameSong(
        { title: "Smells Like Teen Spirit", artist: "Nirvana" },
        { title: "Come As You Are", artist: "Nirvana" },
      ),
    ).toBe(false);
  });

  it("refuse deux chansons sans aucun rapport", () => {
    expect(
      isSameSong(
        { title: "La Bohème", artist: "Charles Aznavour" },
        { title: "HUMBLE.", artist: "Kendrick Lamar" },
      ),
    ).toBe(false);
  });
});
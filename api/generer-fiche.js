// Fonction serverless Vercel — appelle l'API Anthropic côté serveur.
// La clé ANTHROPIC_API_KEY doit être définie dans les variables d'environnement
// du projet Vercel (jamais dans le code ni côté client).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { sujet, duree, contexte } = req.body || {};
  if (!sujet) {
    return res.status(400).json({ error: "Le sujet est requis" });
  }

  const prompt = `Tu es un professeur expérimenté du secondaire, francophone (Bénin).
Prépare une fiche de préparation de cours, TRÈS CONCISE (chaque champ = 1 à 2 phrases courtes maximum).

Sujet : ${sujet}
Classe / chapitre concerné : ${contexte || ""}
Durée de la séance : ${duree || 55} minutes

Réponds UNIQUEMENT avec un objet JSON valide sur une seule ligne, sans texte autour, sans balises markdown, avec exactement ces clés :
{"objectifs":"","prerequis":"","situation_depart":"","activite_decouverte":"","explication":"","exemples":"","exercices":"","activite_remediation":"","evaluation":"","devoir":"","corrige":""}
Reste bref : l'ensemble de la réponse doit tenir en moins de 600 mots.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || "Erreur API Anthropic" });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: "Réponse IA sans JSON détectable" });
    }

    let fiche;
    try {
      fiche = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      const message =
        data.stop_reason === "max_tokens"
          ? "Réponse tronquée (trop longue). Réessayez avec un sujet plus précis."
          : "Impossible de lire la réponse de l'IA.";
      return res.status(500).json({ error: message });
    }

    return res.status(200).json({ fiche });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}

// backend/services/geminiService.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });


/**
 * Usa Gemini per trovare i subreddit più pertinenti per un dato argomento.
 * @param {string} topic - L'argomento di ricerca fornito dall'utente.
 * @returns {Promise<string[]>} - Un array con i nomi dei subreddit consigliati.
 */
async function findSubredditsWithGemini(topic) {
    console.log(`Uso Gemini per trovare i migliori subreddit per: "${topic}"`);
    const prompt = `
        Sei un esperto di community online. Data la seguente richiesta di un utente, elenca i 7 subreddit più pertinenti e attivi a livello globale dove si discute di questo argomento.
        Includi community in diverse lingue se sono molto rilevanti.

        Rispondi ESCLUSIVAMENTE con un array JSON di stringhe. Ogni stringa deve essere solo il nome del subreddit, senza "r/".
        Esempio di risposta per "studenti": ["college", "universitaly", "students", "AskAcademia", "de"]

        Richiesta dell'utente: "${topic}"
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const subreddits = JSON.parse(jsonText);
        console.log(`Subreddit consigliati da Gemini: ${subreddits.join(', ')}`);
        return subreddits;
    } catch (error) {
        console.error("Errore durante la ricerca dei subreddit con Gemini:", error);
        return []; // Ritorna un array vuoto in caso di errore
    }
}


/**
 * Analizza una lista di post usando un prompt condizionale basato sulla query dell'utente.
 * @param {object[]} posts - La lista completa di post raccolti.
 * @param {string} userQuery - La query originale dell'utente per dare contesto all'IA.
 * @returns {Promise<object[]>} - Un array di pain points raggruppati.
 */
async function analyzePainPoints(posts, userQuery) {
    if (!posts || posts.length === 0) return [];
    
    console.log(`Avvio analisi AI unificata su ${posts.length} titoli con contesto: "${userQuery}"`);

    const titlesForAnalysis = posts.map(p => `ID: ${p.id} :: TITOLO: ${p.title}`).join('\n');
    
    const prompt = `
        
        Sei un analista di mercato. Analizza i titoli di post (e opzionalmente i body) forniti per identificare "pain points" specifici e ricorrenti relativi al CONTESTO UTENTE.

INPUT ATTESO:
- ${userQuery}: stringa che definisce il contesto utente.
- ${titlesForAnalysis}: array di oggetti JSON. Ogni oggetto ha almeno:
  {
    "postId": "t3_abcde",
    "title": "Testo del titolo",
    "body": "Testo del body (opzionale)",
    "subreddit": "subreddit_name (opzionale)",
    "upvotes": 123 (opzionale),
    "created_utc": "2024-05-01T12:00:00Z" (opzionale)
  }

OBIETTIVO:
- Estrarre **pain points reali** (problemi concreti che gli utenti riportano) collegati al userQuery.

REGOLE RIGIDE:
0. Devono essere **pain points reali**: problemi riferiti dagli utenti nei post (non ipotesi).
1. **Sii specifico**: non usare categorie vaghe. Es.: "Problemi con l'accesso all'account" è OK; "Problemi tecnici" è troppo generico.
2. **Ignora il rumore**: scarta meme, ringraziamenti, notizie, storie positive, sondaggi senza lamentele, e domande puramente informative. Esempi da ignorare (non esaustivo): "Grazie a tutti!", "Guardate questa immagine", "Breaking: X succede".
3. **Evidenza minima**: ogni pain point deve essere supportato da almeno 2 post diversi **o** da almeno 1 post con upvotes ≥ 100 (se i metadati sono disponibili). Se i metadati non ci sono, usa almeno 2 post.
4. **Titoli concisi**: il campo "painPointTitle" deve avere massimo 8 parole.
5. **Massimo 50 pain points**.
6. **Raggruppamento semantico**: raggruppa post che esprimono lo stesso problema anche se usano parole diverse.
7. **Output obbligatorio**: rispondi **ESCLUSIVAMENTE** con un array JSON valido nel formato:
   [
     {
       "painPointTitle": "Titolo (≤8 parole)",
       "postIds": ["t3_abcde", "t3_fghij", ...]
     },
     ...
   ]
8. **Nessun testo aggiuntivo**: non aggiungere note, spiegazioni o conteggi extra nel messaggio di output. Solo l'array JSON.

ESEMPI (few-shot):
INPUT:
{
  "userQuery":"studenti",
  "titlesForAnalysis":[
    {"postId":"t3_a1","title":"Non mi arriva l'SMS per la verifica","upvotes":12},
    {"postId":"t3_a2","title":"Verifica a due fattori: SMS mai ricevuto","upvotes":8}
  ]
}
OUTPUT:
[
  { "painPointTitle":"Problema con messaggistica SMS", "postIds":["t3_a1","t3_a2"] }
]
INPUT:
{
  "userQuery":"studenti",
  "titlesForAnalysis":[
    {"postId":"t3_c1","title":"Portale studenti Pisa in down da stamattina","upvotes":5},
    {"postId":"t3_c2","title":"Errore 500 su portale studenti Pisa durante pagamento","upvotes":3},
    {"postId":"t3_c3","title":"Il portale di Pisa è inutilizzabile da ieri","upvotes":7}
  ]
}
OUTPUT:
[
  { "painPointTitle":"Problema con portale studenti di Pisa", "postIds":["t3_c1","t3_c2","t3_c3"] }
]
INPUT:
{
  "userQuery":"studenti",
  "titlesForAnalysis":[
    {"postId":"t3_f1","title":"Cerco stanza vicino campus ma tutto è carissimo","upvotes":11},
    {"postId":"t3_f2","title":"Prezzi affitti studenti alle stelle nel centro città","upvotes":14},
    {"postId":"t3_f3","title":"Non trovo una stanza sotto i 400€ vicino all'università","upvotes":7}
  ]
}
OUTPUT:
[
  { "painPointTitle":"Difficoltà trovare alloggio vicino campus", "postIds":["t3_f1","t3_f2","t3_f3"] }
]
INPUT:
{
  "userQuery":"studenti",
  "titlesForAnalysis":[
    {"postId":"t3_d1","title":"Guarda questa foto del mio gatto in biblioteca 😂","upvotes":30},
    {"postId":"t3_d2","title":"Grazie a tutti per i consigli, risolto!","upvotes":4}
  ]
}
OUTPUT:
[]


FILTRI/CONSIGLI INTERNI (opzionali ma utili):
- Se possibile, pesare i post con upvotes per priorizzare pain points più impattanti.
- Evitare duplicati quasi-identici; scegliere un titolo che sia il più descrittivo e specifico.
- Per sarcasmo/umorismo: richiedere segnali testuali chiari (emoji sarcastici + contesto) per decidere se considerare o scartare.

ESEMPIO DI CHIAMATA (pseudocode):
analyze(userQuery, titlesForAnalysis) -> JSON array sopra

Procedi ora usando le regole e il formato richiesti.
TUTTO DEVE ESSERE SCRITTO IN INGLESE!!!
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(jsonText);
        console.log(`Analisi AI completata. Trovati ${analysisResult.length} pain points.`);
        return analysisResult;
    } catch (error) {
        console.error("Errore durante l'analisi con Gemini:", error);
        throw new Error("L'analisi AI non è riuscita.");
    }
}

module.exports = { findSubredditsWithGemini, analyzePainPoints };



// backend/services/redditService.js
const axios = require('axios');
const qs = require('qs'); // La nuova libreria che abbiamo installato

// Questa variabile conserverà il "permesso" (access token) di Reddit
let accessToken = null;

/**
 * Funzione interna per ottenere un gettone di accesso da Reddit.
 * Viene chiamata solo se non abbiamo già un permesso valido.
 */
async function getRedditAccessToken() {
    if (accessToken) return accessToken;

    console.log("Richiedo un nuovo permesso (access token) a Reddit...");
    const authUrl = 'https://www.reddit.com/api/v1/access_token';
    const credentials = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    const data = qs.stringify({ 'grant_type': 'client_credentials' });

    try {
        const response = await axios.post(authUrl, data, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                // IMPORTANTE: Sostituisci "TuoNomeUtenteReddit" con il tuo username!
                'User-Agent': 'PainPointFinder/1.0 by TuoNomeUtenteReddit' 
            }
        });
        accessToken = response.data.access_token;
        console.log("Permesso ottenuto con successo.");

        // Il permesso dura 1 ora. Lo annulliamo dopo 55 minuti per sicurezza.
        setTimeout(() => { accessToken = null; }, 55 * 60 * 1000);

        return accessToken;
    } catch (error) {
        console.error("ERRORE: Impossibile ottenere il permesso da Reddit. Controlla le credenziali.", error.response?.data);
        throw new Error("Autenticazione con Reddit fallita.");
    }
}


/**
 * Funzione unica che raccoglie i post da una lista predefinita di subreddit.
 * (MODIFICATA per usare l'autenticazione)
 */
async function fetchPostsFromSubreddits(subredditList, topic) { // Ho ri-aggiunto 'topic' per la ricerca
    if (!subredditList || subredditList.length === 0) {
        console.log("Nessun subreddit fornito, impossibile raccogliere post.");
        return [];
    }

    // --- MODIFICA 1: Ottieni il permesso prima di fare qualsiasi cosa ---
    const token = await getRedditAccessToken();

    console.log(`Eseguo una ricerca AUTENTICATA per "${topic}" nei subreddit suggeriti...`);

    const limit = 40;
    const fourMonthsAgo = Math.floor((new Date().setMonth(new Date().getMonth() - 4)) / 1000);
    
    // --- MODIFICA 2: Usiamo la ricerca potente invece di /new.json ---
    // Questo è il metodo che funziona su Render e non viene bloccato.
    const subredditQuery = subredditList.map(sub => `subreddit:${sub}`).join(' OR ');
    // Usiamo l'endpoint oauth.reddit.com, che è quello per le richieste autenticate
    const searchUrl = `https://oauth.reddit.com/search.json?q=(${encodeURIComponent(topic)}) AND (${subredditQuery})&sort=new&limit=${limit}&t=all`;
    
    let allPosts = [];

    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'Authorization': `Bearer ${token}`, // Usa il permesso per l'autorizzazione
                // IMPORTANTE: Sostituisci "TuoNomeUtenteReddit" con il tuo username!
                'User-Agent': 'PainPointFinder/1.0 by TuoNomeUtenteReddit' 
            }
        });

        // La logica di estrazione dei post rimane la stessa
        if (response.data && response.data.data) {
            const posts = response.data.data.children;
            const relevantPosts = posts
                .filter(post => post.data.created_utc >= fourMonthsAgo && post.data.title)
                .map(post => ({
                    id: post.data.id,
                    title: post.data.title,
                    text: post.data.selftext || '',
                    url: `https://www.reddit.com${post.data.permalink}`,
                    upvotes: post.data.ups,
                    comments_count: post.data.num_comments,
                }));
            allPosts.push(...relevantPosts);
        }
    } catch (error) {
        console.error(`Errore durante la ricerca autenticata su Reddit: ${error.message}`);
        return []; // In caso di errore, restituisci una lista vuota per non crashare
    }

    console.log(`Trovati ${allPosts.length} post unici in totale.`);
    return allPosts;
}


// Esporta la funzione per poterla usare nel server.js
module.exports = { fetchPostsFromSubreddits };
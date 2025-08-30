// backend/services/redditService.js
const axios = require('axios');

/**
 * Funzione unica che raccoglie i post da una lista predefinita di subreddit.
 * @param {string[]} subredditList - Una lista di nomi di subreddit fornita da Gemini.
 * @returns {Promise<object[]>} - Una lista di post pertinenti.
 */
async function fetchPostsFromSubreddits(subredditList) {
    if (!subredditList || subredditList.length === 0) {
        console.log("Nessun subreddit fornito, impossibile raccogliere post.");
        return [];
    }

    console.log(`Raccolgo post dai subreddit suggeriti: ${subredditList.join(', ')}`);

    const limit = 40; // Prendiamo fino a 100 post da ogni subreddit suggerito
    const fourMonthsAgo = Math.floor((new Date().setMonth(new Date().getMonth() - 4)) / 1000);
    
    // Per ogni subreddit, facciamo una chiamata per prendere i post più nuovi
    let allPosts = [];
    const fetchPromises = subredditList.map(subreddit => {
        const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
        return axios.get(url, { headers: { 'User-Agent': 'Node.js Brainstorming App v10.0' } });
    });

    const responses = await Promise.allSettled(fetchPromises);

    console.log("--- INIZIO ANALISI RISPOSTE DA REDDIT ---");
    responses.forEach((result, index) => {
        // Prendiamo il nome del subreddit per avere contesto
        const subredditName = subredditList[index]; 
        console.log(`Risultato per r/${subredditName}:`);

        if (result.status === 'fulfilled') {
            // La richiesta ha avuto successo, ma cosa c'è dentro?
            const postCount = result.value.data?.data?.children?.length || 0;
            console.log(` -> Stato: Successo. Post trovati: ${postCount}`);
        } else { // result.status === 'rejected'
            // La richiesta è FALLITA! Questa è la prova che cerchiamo.
            console.log(` -> Stato: FALLITO.`);
            // Stampiamo il motivo esatto del fallimento
            console.error(` -> Motivo del fallimento per r/${subredditName}:`, result.reason.message);
        }
    });
    console.log("--- FINE ANALISI RISPOSTE DA REDDIT ---");

    // Rimuoviamo eventuali duplicati
    const uniquePosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());
    console.log(`Trovati ${uniquePosts.length} post unici in totale.`);
    return uniquePosts;
}

module.exports = { fetchPostsFromSubreddits };



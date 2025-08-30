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

    responses.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data && result.value.data.data) {
            const posts = result.value.data.data.children;
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
    });

    // Rimuoviamo eventuali duplicati
    const uniquePosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());
    console.log(`Trovati ${uniquePosts.length} post unici in totale.`);
    return uniquePosts;
}

module.exports = { fetchPostsFromSubreddits };



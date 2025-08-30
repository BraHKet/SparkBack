// backend/server.js
const express = require('express');
const cors = require('cors');
const { fetchPostsFromSubreddits, findMorePostsForPainPoint } = require('./services/redditService');
const { findSubredditsWithGemini, analyzePainPoints, filterRelevantPosts } = require('./services/geminiService');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/brainstorm', async (req, res) => {
    const { topic } = req.body; // 'topic' è la query/soggetto dell'utente
    if (!topic) return res.status(400).json({ error: 'Il campo "topic" è obbligatorio.' });

    try {
        // PASSO 1: Trova i migliori subreddit usando Gemini (1 chiamata a Gemini)
        const subredditList = await findSubredditsWithGemini(topic);
        if (subredditList.length === 0) {
            console.log("Gemini non ha suggerito subreddit, l'analisi si ferma.");
            return res.json([]);
        }

        // PASSO 2: Raccogli i post da questi subreddit di alta qualità (chiamate a Reddit)
        const allPosts = await fetchPostsFromSubreddits(subredditList);
        if (allPosts.length === 0) {
            console.log("Nessun post trovato nei subreddit suggeriti.");
            return res.json([]);
        }

        // PASSO 3: Analizza i titoli con il prompt unificato (1 chiamata a Gemini)
        const structuredPainPoints = await analyzePainPoints(allPosts, topic);
        
        // PASSO 4: Arricchisci e invia i risultati
        const finalResults = structuredPainPoints.map(pp => {
            const associatedPosts = pp.postIds
                .map(id => allPosts.find(p => p.id === id))
                .filter(Boolean);

            if (associatedPosts.length === 0) return null;

            const engagementScore = associatedPosts.reduce((acc, post) => acc + post.upvotes + post.comments_count, 0);

            return {
                title: pp.painPointTitle,
                posts: associatedPosts,
                engagementScore,
            };
        }).filter(Boolean);
        
        finalResults.sort((a, b) => b.engagementScore - a.engagementScore);
        
        res.json(finalResults);

    } catch (error) {
        if (error.message.includes("429") || (error.status && error.status === 429)) {
            return res.status(429).json({ error: "Quota API di Gemini esaurita o troppe richieste. Riprova tra un minuto." });
        }
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/collect-more-info', async (req, res) => {
    
});


app.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
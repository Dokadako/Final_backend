require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

const dbUri = process.env.DB_URI;

mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define product schema
const productSchema = new mongoose.Schema({
    title: String,
    price: String,
    image: String,
    description: String
});

const Product = mongoose.model('Product', productSchema);

app.use(cors());

// Function to fetch product description
async function fetchDescription(productUrl) {
    try {
        const { data } = await axios.get(productUrl);
        const $ = cheerio.load(data);
        const description = $('.description .editors').text().trim();
        return description;
    } catch (error) {
        console.error(`Error fetching description from ${productUrl}:`, error.message);
        return '';
    }
}

// Function to fetch data from a single page
async function fetchPage(url, page) {
    const pageUrl = `${url}?page=${page}`;
    console.log(`Fetching page ${pageUrl}`);
    try {
        const { data } = await axios.get(pageUrl);
        const $ = cheerio.load(data);
        const items = [];
        const promises = $('.item').map(async (index, element) => {
            const title = $(element).find('.desc').text().trim();
            const price = $(element).find('.cost').text().trim();
            const image = $(element).find('img').attr('src');
            let productUrl = $(element).find('a').attr('href');

            if (!productUrl) {
                console.error(`Product URL is missing for item at index ${index} on page ${page}`);
                return null;
            }

            if (!productUrl.startsWith('http')) {
                productUrl = `https://svg.moda${productUrl}`;
            }

            const description = await fetchDescription(productUrl);
            return { title, price, image, description };
        }).get();

        const resolvedItems = await Promise.all(promises);
        return resolvedItems.filter(item => item !== null);
    } catch (error) {
        console.error(`Error fetching page ${page} for URL ${url}:`, error.message);
        return [];
    }
}

async function fetchAllPages(urls, maxPages) {
    const allItems = [];
    for (const url of urls) {
        for (let page = 1; page <= maxPages; page++) {
            const items = await fetchPage(url, page);
            allItems.push(...items);
        }
    }
    return allItems;
}

app.get('/api/products', async (req, res) => {
    try {
        // Always fetch new data (for testing)
        const maxPages = 5;
        const urls = [
            'https://svg.moda/mens/odezhda-dlya-muzhchin/svitshoty-i-tolstovki-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/bryuki-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/dzhinsy-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/zhilety-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/kardigany-i-svitery-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/kurtki-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/palto-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/pidzhaki-i-blejzery-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/rubashki-i-polo-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/sportivnye-bryuki-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/futbolki-i-majki-dlya-muzhchin',
            'https://svg.moda/mens/odezhda-dlya-muzhchin/shorty-dlya-muzhchin'
        ];

        // Fetch new data and replace existing
        const products = await fetchAllPages(urls, maxPages);
        await Product.deleteMany({});
        await Product.insertMany(products);

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
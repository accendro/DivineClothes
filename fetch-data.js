const fs = require('fs');

// 👉 PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
const API_URL = "https://script.google.com/macros/s/AKfycbwI4LADFOyL0ubKkH7KB0pQMRqN0utXj5iN9waZkwNXk311Q7jzbLCjcy8SWar9VZvX_Q/exec";

async function fetchProducts() {
  try {
    console.log("🤖 Robot starting: Fetching data from Google Sheets...");
    
    // Fetch data from Google
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Crash protection: Make sure Google didn't return an error object
    if (data.error) {
      throw new Error(`Google Apps Script Error: ${data.error}`);
    }
    
    // Write the data to products.json, formatting it beautifully with 2 spaces
    fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
    
    console.log(`✅ Success! Updated products.json with ${data.length} products.`);
    
  } catch (error) {
    console.error("❌ Fatal Error fetching data:", error);
    // This tells GitHub Actions to "Fail" the run so you know something went wrong
    process.exit(1);
  }
}

// Run the function
fetchProducts();
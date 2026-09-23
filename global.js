// 🏬 STORE IDENTITY (Prevents cart mixing between clients!)
// Change this prefix for each new client (e.g., "ClientA_")
const STORE_ID = "DivineClothes_";
// ==========================================


// 👉 IMPORTANT: Paste your exact Google Apps Script URL here!
        const API_URL = "https://script.google.com/macros/s/AKfycbwI4LADFOyL0ubKkH7KB0pQMRqN0utXj5iN9waZkwNXk311Q7jzbLCjcy8SWar9VZvX_Q/exec";
  
  
// ==========================================
// 💳 PAYMENT & BKASH OFFERS
// Leave BKASH_NUMBER empty ("") to only show Cash On Delivery.
// Leave a DISCOUNT empty ("") or 0 to hide that specific offer.
// ==========================================
const BKASH_NUMBER = "";
const DISCOUNT_PARTIAL = "20";
const DISCOUNT_FULL = "30";
// ==========================================

// 🎯 META PIXEL SETTINGS
const META_PIXEL_ID = "2610960206028854";


//  CHANGE THIS FOR EACH CLIENT'Facebook page
const facebookPageUsername = "divineclothesbd";


// 🚚 AGENCY CLIENT DELIVERY SETTINGS
const LOC_INSIDE = "Inside Dhaka"; // Type in English or Bengali
const FEE_INSIDE = 80;

const LOC_OUTSIDE = "Outside Dhaka";
const FEE_OUTSIDE = 130;


// ==========================================
// 📱 About Section SOCIAL & CONTACT LINKS
// Leave empty ("") if a client doesn't have one!
// ==========================================
const LINK_FACEBOOK = "https://www.facebook.com/divineclothesbd";
const LINK_YOUTUBE = "";
const LINK_TIKTOK = "";
const LINK_PHONE = "";
const LINK_EMAIL = "";
const LINK_MAPS = "";
// ==========================================










// ======================================================
const DATA_URL = './products.json';
// 1. Fetch JSON Data (UPDATED WITH SMART FORMATTER)
// 1. Fetch JSON Data (UPDATED WITH STOCK CHECKER)
// 1. Fetch JSON Data (UPDATED WITH KEYWORDS)
// 1. Fetch JSON Data (UPDATED WITH CRASH PROTECTION)
// 1. Fetch JSON Data (UPDATED WITH VARIANT PRICING)
// --- 1. FETCH JSON DATA (CRASH, CACHE & DUPLICATE ID PROOF) ---
async function getProducts() {
    try {
        // Cache-Buster: Forces the browser to load newest data
        const cacheBusterUrl = DATA_URL + '?v=' + new Date().getTime();
        const response = await fetch(cacheBusterUrl);
        let rawData = await response.json();
        
        // NEW: Memory list to remember which IDs we have already seen
        let seenIds = new Set(); 
        
        let cleanData = rawData.map((p, index) => {
            // Force ID to be a clean string
            p.id = p.id ? String(p.id).trim() : `auto-id-${index}`;
            
            // --- NEW: DUPLICATE ID PROTECTION ---
            // If the client accidentally used this ID already, auto-fix it!
            if (seenIds.has(p.id)) {
                console.warn(`Duplicate ID detected: ${p.id}. Auto-fixing to prevent crash.`);
                p.id = `${p.id}-dup-${index}`; 
            }
            seenIds.add(p.id); 
            
            // Image handling
            if (typeof p.images === 'string') p.images = p.images.split(',').map(i => i.trim()).filter(i => i !== "");
            else if (!p.images || !Array.isArray(p.images) || p.images.length === 0) p.images =["https://via.placeholder.com/400?text=No+Image"];
            
            // Sizes & Tags & Keywords
            if (typeof p.sizes === 'string') p.sizes = p.sizes.split(',').map(s => s.trim()).filter(s => s !== "");
            else p.sizes =[];
            
            if (typeof p.tags === 'string') p.tags = p.tags.split(',').map(t => t.trim()).filter(t => t !== "");
            else p.tags =[];
            
            if (typeof p.keywords === 'string') p.keywords = p.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k !== "");
            else p.keywords =[];
            
            // Variant Prices & Colors
            if (typeof p.colors === 'string' && p.colors.trim() !== "") {
                p.colors = p.colors.split(',').map(c => {
                    let parts = c.split('|');
                    let colorName = parts[0] ? parts[0].trim() : "Default";
                    let imgUrl = parts[1] ? parts[1].trim() : "";
                    let colorPrice = parts[2] && !isNaN(parseInt(parts[2])) ? parseInt(parts[2].trim()) : null;
                    if (imgUrl.startsWith("urlhttp")) imgUrl = imgUrl.replace("urlhttp", "http");
                    return { name: colorName, img: imgUrl, price: colorPrice };
                });
            } else { p.colors =[]; }
            
            // Numbers & Booleans
            p.show_sold = (p.show_sold === "TRUE" || p.show_sold === true);
            p.sold = parseInt(p.sold) || 0;
            p.price = parseInt(p.price) || 0;
            if (p.original_price === "") p.original_price = null; else p.original_price = parseInt(p.original_price);
            p.in_stock = (p.in_stock === "FALSE" || p.in_stock === false) ? false : true;
            
            return p;
        });
        
        return cleanData;
        
    } catch (error) { 
        console.error("Error fetching products:", error); 
        return []; 
    }
}




// --- NEW: TYPO TOLERANCE (FUZZY SEARCH) ---
// Calculates how many letters are different between two words
function getTypoDistance(a, b) {
    if (a.length === 0) return b.length; 
    if (b.length === 0) return a.length; 
    let matrix =[];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i-1) === a.charAt(j-1)) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

// Checks if the typed word matches or is very close to a database word
function isCloseMatch(typedWord, databaseString) {
    if (databaseString.includes(typedWord)) return true; // Exact partial match (e.g., "cott" in "cotton")
    
    // Split database string into individual words to check for typos
    let dbWords = databaseString.split(/[\s,\|-]+/); 
    for (let dbWord of dbWords) {
        // If the word lengths are somewhat similar, check typo distance
        if (Math.abs(dbWord.length - typedWord.length) <= 2 && typedWord.length > 3) {
            let typos = getTypoDistance(dbWord, typedWord);
            if (typos <= 2) return true; // Allows up to 2 wrong letters (e.g. "cottu" -> "cotton")
        }
    }
    return false;
}

function getUrlParam(param) { return new URLSearchParams(window.location.search).get(param); }
function getCart() { const c = localStorage.getItem(STORE_ID + 'my_cart'); return c ? JSON.parse(c) :[]; }

function addToCart(product, variant) {
    let cart = getCart();
    let exist = cart.find(i => i.product.id === product.id && i.variant.color.name === variant.color.name && i.variant.size === variant.size);
    if (exist) exist.variant.qty += variant.qty;
    else cart.push({ product, variant });
    
    localStorage.setItem(STORE_ID + 'my_cart', JSON.stringify(cart));
    updateCartIcon();
}

function updateCartIcon() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.variant.qty, 0);
    
    document.querySelectorAll('.cart-badge').forEach(badge => {
        if(totalItems > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = totalItems;
        } else {
            badge.style.display = 'none';
        }
    });
}

// Global Toast Notification
// --- UPDATED: DARAZ STYLE TOAST NOTIFICATION ---
// --- UPDATED: SWIPEABLE DARAZ STYLE TOAST ---
let toastTimeout;
function showToast(message, isSuccess = true) {
    let toast = document.getElementById('global-toast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        document.body.appendChild(toast);
    }
    
    clearTimeout(toastTimeout); // Reset timer if clicked multiple times
    toast.className = 'toast-notification'; 
    toast.style.transform = ''; // Reset any swipe movement
    
    const icon = isSuccess 
        ? '<i class="ri-checkbox-circle-fill" style="color:#4cd137; font-size: 45px; line-height:1;"></i>' 
        : '<div style="background:var(--primary); color:white; width: 45px; height: 45px; display:flex; justify-content:center; align-items:center; border-radius:50%; font-size:24px; font-weight:bold;">!</div>';
        
    toast.innerHTML = `${icon} <div style="font-weight:500;">${message}</div>`;
    
    // Force browser reflow to ensure animation triggers
    void toast.offsetWidth;
    toast.classList.add('show');
    
    // --- NEW: Swipe & Click to Dismiss Logic ---
    let startX = 0;
    toast.ontouchstart = (e) => { startX = e.touches[0].clientX; };
    toast.ontouchend = (e) => {
        let diffX = e.changedTouches[0].clientX - startX;
        // If user swiped more than 40px left or right, hide it
        if (Math.abs(diffX) > 40) toast.classList.remove('show');
    };
    // Also allow simple tap to dismiss
    toast.onclick = () => toast.classList.remove('show');
    
    // Default visibility timer
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}



// --- MESSENGER ROUTING (WITH AUTO-COPY URL) ---
// --- MESSENGER ROUTING (SILENT TRACKING VIA REF PARAMETER) ---
// --- TEST METHOD 2: ON-SITE LAZY CHAT BUBBLE ---
// --- MESSENGER ROUTING (AUTO-COPY & SILENT TRACKING) ---
// --- MESSENGER ROUTING (AUTO-COPY WITH META KEYWORD TRIGGER) ---
// --- MESSENGER ROUTING (CLEAN LINK + AUTO-COPY) ---
function openMessenger() {
    const currentUrl = window.location.href;
    
    
    
    // Default message (Used on Home Page)
    let message = `#WebOrder\n\nহ্যালো! আমি আপনাদের ওয়েবসাইট থেকে এই পেজটি দেখছি:\n${currentUrl}`;
    let refParam = 'website_home';
    
    // --- CONTEXT 1: THANK YOU PAGE ---
    if (currentUrl.includes('thankyou.html')) {
        const orderId = localStorage.getItem(STORE_ID + 'last_order_id');
        if (orderId) {
            message = `#WebOrder\n\nহ্যালো! আমি এইমাত্র একটি অর্ডার করেছি।\nআমার অর্ডার আইডি: ${orderId}\n\nআমি আমার অর্ডার সম্পর্কে কিছু জানতে চাচ্ছি।`;
            refParam = `order_${orderId}`;
        }
    }
    // --- CONTEXT 2: CHECKOUT PAGE ---
    else if (currentUrl.includes('checkout.html')) {
        const cartText = localStorage.getItem(STORE_ID + 'my_cart');
        if (cartText) {
            const cart = JSON.parse(cartText);
            if (cart.length > 0) {
                // Extract the base URL so we can generate direct product links
                const baseUrl = currentUrl.split('checkout.html')[0];
                
                let itemsList = cart.map(item => {
                    let productLink = `${baseUrl}product.html?id=${item.product.id}`;
                    return `- ${item.product.name} (Qty: ${item.variant.qty})\n  লিংক: ${productLink}`;
                }).join('\n\n');
                
                message = `#WebOrder\n\nহ্যালো! আমি চেকআউট পেজে আছি এবং এই প্রোডাক্টগুলো নিতে চাচ্ছি:\n\n${itemsList}`;
                refParam = 'checkout_page';
            }
        }
    }
    // --- CONTEXT 3: PRODUCT PAGE ---
    else {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        
        if (productId && typeof currentProduct !== 'undefined' && currentProduct) {
            message = `#WebOrder\n\nহ্যালো! আমি ওয়েবসাইটের এই প্রোডাক্টটি নিতে চাচ্ছি:\n${currentProduct.name}\n\nলিংক: ${currentUrl}`;
            refParam = `prod_${productId}`;
        }
    }
    
    // 1. Secretly Auto-Copy to their clipboard
    let textArea = document.createElement("textarea");
    textArea.value = message;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') {
            showToast("Message copied! Please PASTE it in the chat.", true);
        }
    } catch (err) {
        console.log("Copy to clipboard failed.");
    }
    document.body.removeChild(textArea);
    
    // 2. Open Native Messenger App
    // Increased delay slightly to 800ms so they have time to read the "Copied!" toast before the app switches
    setTimeout(() => {
        window.location.href = `https://m.me/${facebookPageUsername}?ref=${refParam}`;
    }, 400);
}


document.addEventListener('DOMContentLoaded', updateCartIcon);


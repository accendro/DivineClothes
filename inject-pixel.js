const fs = require('fs');

try {
  // 1. Read global.js to find the Client's specific Pixel ID
  const globalJs = fs.readFileSync('global.js', 'utf8');
  const match = globalJs.match(/const\s+META_PIXEL_ID\s*=\s*["'](\d+)["']/);
  
  if (!match || !match[1]) {
    console.log("No Meta Pixel ID found in global.js. Skipping injection.");
    process.exit(0);
  }
  
  const pixelId = match[1];
  console.log(`Found Pixel ID: ${pixelId}. Hardcoding into HTML files...`);
  
  // 2. The exact hardcoded Meta Pixel script (NOW INCLUDES <noscript>)
  const pixelScript = `
    <!-- AUTO-INJECTED META PIXEL -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
    <!-- END AUTO-INJECTED META PIXEL -->
    </head>`;
  
  // 3. Loop through all HTML files
  const htmlFiles = ['index.html', 'product.html', 'checkout.html', 'thankyou.html'];
  
  htmlFiles.forEach(file => {
    if (fs.existsSync(file)) {
      let html = fs.readFileSync(file, 'utf8');
      
      // MAGIC TRICK: This completely erases any previous auto-injected pixel so you never get duplicates!
      html = html.replace(/<!-- AUTO-INJECTED META PIXEL -->[\s\S]*?<!-- END AUTO-INJECTED META PIXEL -->\s*<\/head>/g, '</head>');
      
      // Inject the fresh pixel perfectly into the head
      html = html.replace('</head>', pixelScript);
      
      fs.writeFileSync(file, html);
      console.log(`Successfully hardcoded Pixel into ${file}`);
    }
  });
  
} catch (error) {
  console.error("Error injecting pixel:", error);
}
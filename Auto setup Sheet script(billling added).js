// ==========================================
// ACCENDRO AGENCY - UNIFIED BACKEND API
// ==========================================

// ⚙️ THE CONTROL PANEL: CHANGE THESE PER CLIENT ⚙️
const SECRET_PW = "1234"; // admin panel password
const BILLING_DAY = 2; // (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) Set to the day BEFORE you send the bill! 

// 💰 BILLING SETTINGS 💰
const BILLING_MODE = "PERCENTAGE"; // Change to "PERCENTAGE" or "FIXED"
const CLIENT_PERCENTAGE = 0.08; // Used if mode is "PERCENTAGE" (0.10 = 10%)
const FIXED_FEE_PER_ORDER = 50; // Used if mode is "FIXED" (e.g., 50 BDT per order)

// ⚠️ PUT YOUR CLIENT'S STEADFAST KEYS HERE ⚠️
const STEADFAST_API_KEY = ""; //Steadfast API
const STEADFAST_SECRET = ""; //Steadfast Secret Key

// 🚀 META CONVERSIONS API (CAPI) SETTINGS 🚀
const META_PIXEL_ID = "2610960206028854"; 
const META_CAPI_TOKEN = "EAAXLhEfQSt0BSoqDWJ8DzXiGAhk2l9SXQjEIDCnOJIZBYGk5BUSZByzbn5JsVZB1gqoamEl8LGRaZCWJ8kYbFrrXdIczdhzqpR3vw3Q3QpCNu6EkGu834LT9rMLVEpaZC8iNa6BZAduxBexCA0HnAyTYBW0EqfkRvErWT9IHVKZABhALUhEwGVdTVhZCqHH0XcVhYwZDZD"; // <--- PASTE YOUR CAPI TOKEN HERE
// ==========================================

// --- META CAPI ENGINE ---
function sendToMetaCAPI(eventName, customerPhone, orderId, orderValue) {
  if (!META_PIXEL_ID || !META_CAPI_TOKEN || META_CAPI_TOKEN === "") return;

  function hashData(str) {
    if (!str) return "";
    let cleanStr = String(str).trim().toLowerCase();
    let digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cleanStr);
    return digest.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  }

  let cleanPhone = String(customerPhone).replace(/\D/g, '');
  if (cleanPhone.length === 11 && cleanPhone.startsWith("01")) {
    cleanPhone = "88" + cleanPhone;
  }

  let payload = {
    "data": [
      {
        "event_name": eventName, 
        "event_time": Math.floor(new Date().getTime() / 1000),
        "action_source": "system_generated",
        "user_data": {
          "ph": [hashData(cleanPhone)]
        },
        "custom_data": {
          "currency": "BDT",
          "value": parseFloat(orderValue) || 0,
          "order_id": orderId
        }
      }
    ]
  };

  let options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  let url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`;
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch(e) {
    console.log("CAPI Error: ", e);
  }
}
// -----------------------

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (e.parameter.pw) {
      if (e.parameter.pw !== SECRET_PW) {
        return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized access" })).setMimeType(ContentService.MimeType.JSON);
      }
      let crmSheet = ss.getSheetByName("CRM");

      // ONE-CLICK DISPATCH
      if (e.parameter.action === "bookSteadfast" && e.parameter.rowIndex) {
        const headers = crmSheet.getRange(1, 1, 1, crmSheet.getLastColumn()).getValues()[0];
        const statusCol = headers.indexOf("Status") + 1;
        const trackingCol = headers.indexOf("Tracking ID") + 1;
        const updateCol = headers.indexOf("Last Updated") + 1;

        const payload = {
          "invoice": e.parameter.orderId,
          "recipient_name": e.parameter.customerName,
          "recipient_phone": e.parameter.customerPhone,
          "recipient_address": e.parameter.customerAddress,
          "cod_amount": parseFloat(e.parameter.codAmount) || 0,
          "note": e.parameter.note || ""
        };

        const options = {
          "method": "post",
          "headers": {
            "Api-Key": STEADFAST_API_KEY,
            "Secret-Key": STEADFAST_SECRET,
            "Content-Type": "application/json"
          },
          "payload": JSON.stringify(payload),
          "muteHttpExceptions": true
        };

        try {
          const response = UrlFetchApp.fetch("https://portal.packzy.com/api/v1/create_order", options);
          const result = JSON.parse(response.getContentText());

          if (response.getResponseCode() === 200 && result.consignment && result.consignment.consignment_id) {
            let newTrackingId = result.consignment.consignment_id;
            if (trackingCol > 0) crmSheet.getRange(parseInt(e.parameter.rowIndex), trackingCol).setValue(newTrackingId);
            if (statusCol > 0) crmSheet.getRange(parseInt(e.parameter.rowIndex), statusCol).setValue("Shipped");
            if (updateCol > 0) crmSheet.getRange(parseInt(e.parameter.rowIndex), updateCol).setValue(new Date());
            
            return ContentService.createTextOutput(JSON.stringify({ status: "success", trackingId: newTrackingId })).setMimeType(ContentService.MimeType.JSON);
          } else {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: JSON.stringify(result.errors || result.message || "Steadfast API Error") })).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message})).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // AUTOMATIC STEADFAST TRACKING SYNC
      if (e.parameter.sync === "true") {
        let tempData = crmSheet.getDataRange().getValues();
        let tempHeaders = tempData[0];
        const statusCol = tempHeaders.indexOf("Status");
        const trackingCol = tempHeaders.indexOf("Tracking ID");
        const countedStatusCol = tempHeaders.indexOf("Counted Status") + 1;
        const countedDateCol = tempHeaders.indexOf("Counted Date") + 1;
        
        const phoneCol = tempHeaders.indexOf("Phone");
        const orderIdCol = tempHeaders.indexOf("Order ID");
        const priceCol = tempHeaders.indexOf("Total Price");
        
        if (statusCol > -1 && trackingCol > -1) {
          let requests = [];
          let rowIndexes =[];
          
          for (let i = 1; i < tempData.length; i++) {
            if ((tempData[i][statusCol] === "Shipped" || tempData[i][statusCol] === "Confirmed") && tempData[i][trackingCol]) {
              let cid = String(tempData[i][trackingCol]).replace(/\D/g, ''); 
              if (cid) {
                requests.push({
                  url: `https://portal.packzy.com/api/v1/status_by_cid/${cid}`,
                  headers: { "Api-Key": STEADFAST_API_KEY, "Secret-Key": STEADFAST_SECRET },
                  method: "get",
                  muteHttpExceptions: true
                });
                rowIndexes.push(i + 1); 
              }
            }
          }
          
          if (requests.length > 0) {
            let responses = UrlFetchApp.fetchAll(requests);
            let changesMade = false;
            let currentTime = new Date();
            
            responses.forEach((res, index) => {
              if (res.getResponseCode() === 200) {
                try {
                  let json = JSON.parse(res.getContentText());
                  if (json && json.delivery_status) {
                    let targetRow = rowIndexes[index];
                    if (json.delivery_status === "delivered") {
                      crmSheet.getRange(targetRow, statusCol + 1).setValue("Delivered");
                      if (countedStatusCol > 0) crmSheet.getRange(targetRow, countedStatusCol).setValue("counted");
                      if (countedDateCol > 0) {
                         let existingDate = crmSheet.getRange(targetRow, countedDateCol).getValue();
                         if (!existingDate) crmSheet.getRange(targetRow, countedDateCol).setValue(currentTime);
                      }
                      
                      if (phoneCol > -1 && orderIdCol > -1 && priceCol > -1) {
                         let cPhone = tempData[targetRow-1][phoneCol];
                         let cOrder = tempData[targetRow-1][orderIdCol];
                         let cPrice = String(tempData[targetRow-1][priceCol]).replace(/[^\d.-]/g, '');
                         sendToMetaCAPI("Delivered_Order", cPhone, cOrder, cPrice);
                      }
                      
                      changesMade = true;
                    } else if (json.delivery_status === "returned" || json.delivery_status === "cancelled" || json.delivery_status === "unknown") {
                      crmSheet.getRange(targetRow, statusCol + 1).setValue("Failed Delivery");
                      changesMade = true;
                    }
                  }
                } catch(err) {}
              }
            });
            if (changesMade) updateWeeklySummary(crmSheet); 
          }
        }
      }
      
      const data = crmSheet.getDataRange().getValues();
      if (data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      
      const headers = data[0];
      const cleanHeaders = headers.map(h => h.replace(/[^a-zA-Z0-9]/g, '_'));
      const jsonArray = data.slice(1).map((row, index) => {
        let obj = {};
        cleanHeaders.forEach((header, i) => { obj[header] = row[i]; });
        obj.rowIndex = index + 2;
        return obj;
      });
      return ContentService.createTextOutput(JSON.stringify(jsonArray)).setMimeType(ContentService.MimeType.JSON);
    } else {
      let sheet = ss.getSheetByName("Products");
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      
      const headers = data[0];
      const products = [];
      
      for (let i = 1; i < data.length; i++) {
        let row = data[i];
        let product = {};
        for (let j = 0; j < headers.length; j++) {
          let headerName = headers[j].toString().trim();
          if (headerName) {
            let cellValue = row[j];
            if (headerName === 'in_stock' || headerName === 'show_sold') {
              cellValue = String(cellValue).toUpperCase().trim() === "TRUE";
            }
            product[headerName] = cellValue;
          }
        }
        if (product.id || product.name) products.push(product);
      }
      return ContentService.createTextOutput(JSON.stringify(products)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let data;
    if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch (err) { data = e.parameter; }
    } else { data = e.parameter; }
    
    if (Array.isArray(data)) {
      let sheet = ss.getSheetByName("Products");
      if (data.length > 0) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        const newRows = data.map(item => headers.map(header => (header === 'in_stock' || header === 'show_sold') ? (item[header] ? true : false) : (item[header] !== undefined ? item[header] : '')));
        sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'empty' })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.pw && data.pw === SECRET_PW && data.rowIndex) {
      let crmSheet = ss.getSheetByName("CRM");
      const headers = crmSheet.getRange(1, 1, 1, crmSheet.getLastColumn()).getValues()[0];
      const statusCol = headers.indexOf("Status") + 1;
      const noteCol = headers.indexOf("Admin Note") + 1;
      const trackingCol = headers.indexOf("Tracking ID") + 1;
      const updateCol = headers.indexOf("Last Updated") + 1;
      const countedStatusCol = headers.indexOf("Counted Status") + 1;
      const countedDateCol = headers.indexOf("Counted Date") + 1;
      
      const currentTime = new Date();
      
      let previousStatus = "";
      if (statusCol > 0) previousStatus = crmSheet.getRange(data.rowIndex, statusCol).getValue();
      
      if (statusCol > 0) crmSheet.getRange(data.rowIndex, statusCol).setValue(data.status);
      if (noteCol > 0) crmSheet.getRange(data.rowIndex, noteCol).setValue(data.adminNote || "");
      if (updateCol > 0) crmSheet.getRange(data.rowIndex, updateCol).setValue(currentTime); 
      if (trackingCol > 0 && data.trackingId !== undefined) crmSheet.getRange(data.rowIndex, trackingCol).setValue(data.trackingId);
      
      if (countedStatusCol > 0 && countedDateCol > 0) {
        if (data.status === "Delivered") {
          crmSheet.getRange(data.rowIndex, countedStatusCol).setValue("counted");
          let existingCountedDate = crmSheet.getRange(data.rowIndex, countedDateCol).getValue();
          if (!existingCountedDate || existingCountedDate === "") crmSheet.getRange(data.rowIndex, countedDateCol).setValue(currentTime);
          
          if (previousStatus !== "Delivered") {
             const phoneCol = headers.indexOf("Phone") + 1;
             const orderIdCol = headers.indexOf("Order ID") + 1;
             const priceCol = headers.indexOf("Total Price") + 1;
             if(phoneCol > 0 && orderIdCol > 0 && priceCol > 0) {
                let cPhone = crmSheet.getRange(data.rowIndex, phoneCol).getValue();
                let cOrder = crmSheet.getRange(data.rowIndex, orderIdCol).getValue();
                let cPrice = String(crmSheet.getRange(data.rowIndex, priceCol).getValue()).replace(/[^\d.-]/g, '');
                sendToMetaCAPI("Delivered_Order", cPhone, cOrder, cPrice);
             }
          }
          
        } else {
          crmSheet.getRange(data.rowIndex, countedStatusCol).setValue("uncounted");
        }
      }
      updateWeeklySummary(crmSheet);
      return ContentService.createTextOutput("Success");
    }
    else {
      let rawSheet = ss.getSheetByName("RawOrders");
      let crmSheet = ss.getSheetByName("CRM");
      const currentTime = new Date();
      let incomingDate;
      if (data.date) {
        incomingDate = new Date(data.date);
        if (isNaN(incomingDate.getTime())) {
          let cleanStr = data.date.replace(/,/g, '');
          let parts = cleanStr.split(/[\/\-\s:]/);
          if (parts.length >= 3) incomingDate = new Date(parts[2], parts[1]-1, parts[0], parts[3]||0, parts[4]||0, parts[5]||0);
        }
        if (isNaN(incomingDate.getTime())) incomingDate = currentTime; 
      } else { incomingDate = currentTime; }
      
      const rowData =[data.orderId || "N/A", incomingDate, data.name || "No Name", data.phone || "No Phone", data.address || "No Address", data.note || "No Note", data.orderDetails || "", data.imageLinks || "", data.subtotalPrice || "0", data.totalPrice || "0", data.ipInfo || "Not captured"];
      rawSheet.appendRow(rowData);
      
      const cHeaders = crmSheet.getRange(1, 1, 1, crmSheet.getLastColumn()).getValues()[0];
      const hasTrackingCol = cHeaders.includes("Tracking ID");
      if (hasTrackingCol) crmSheet.appendRow([...rowData, "New", "", "", currentTime, "uncounted", ""]);
      else crmSheet.appendRow([...rowData, "New", "", currentTime, "uncounted", ""]);
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "success" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) { return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.message })).setMimeType(ContentService.MimeType.JSON); } finally { lock.releaseLock(); }
}


// ==========================================
// WEEKLY SUMMARY ENGINE & AUTO-COLUMN RECOVERY
// ==========================================
function updateWeeklySummary(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return; 
  
  let headers = data[0];
  
  // 🔥 DYNAMIC HEADER BASED ON BILLING MODE 🔥
  const chargeHeaderName = BILLING_MODE === "FIXED" 
      ? `Client Charge (${FIXED_FEE_PER_ORDER} Fixed)` 
      : `Client Charge (${CLIENT_PERCENTAGE * 100}%)`;
  
  const requiredColumns =["Counted Status", "Counted Date", "Week End Date", chargeHeaderName, "Counted Order IDs"];
  let headersModified = false;
  let currentMaxCol = headers.length;
  
  requiredColumns.forEach(col => {
    let isChargeCol = col.includes("Client Charge");
    let idx = isChargeCol ? headers.findIndex(h => h.toString().includes("Client Charge")) : headers.indexOf(col);
      
    if (idx === -1) {
      sheet.getRange(1, currentMaxCol + 1).setValue(col);
      headers.push(col); 
      currentMaxCol++;
      headersModified = true;
    } else if (isChargeCol && headers[idx] !== col) {
      sheet.getRange(1, idx + 1).setValue(col);
      headers[idx] = col;
    }
  });

  if (headersModified) SpreadsheetApp.flush();
  if (data.length <= 1) return; 

  const idIdx = headers.indexOf("Order ID");
  const dateIdx = headers.indexOf("Timestamp");
  const subIdx = headers.indexOf("Subtotal");
  const statusIdx = headers.indexOf("Counted Status");
  const countedDateIdx = headers.indexOf("Counted Date");
  const weekEndIdx = headers.indexOf("Week End Date");

  if (idIdx === -1 || dateIdx === -1 || weekEndIdx === -1) return; 

  function getWeekEnd(dateVal) {
    if (!dateVal) return null;
    let dateObj = new Date(dateVal);
    if (isNaN(dateObj.getTime())) return null;
    let tz = sheet.getParent().getSpreadsheetTimeZone();
    let year = parseInt(Utilities.formatDate(dateObj, tz, "yyyy"));
    let month = parseInt(Utilities.formatDate(dateObj, tz, "MM")) - 1; 
    let day = parseInt(Utilities.formatDate(dateObj, tz, "dd"));
    
    let pureDate = new Date(Date.UTC(year, month, day));
    let dayOfWeek = pureDate.getUTCDay(); 
    let add = (BILLING_DAY - dayOfWeek + 7) % 7;
    pureDate.setUTCDate(pureDate.getUTCDate() + add);
    
    let targetYear = pureDate.getUTCFullYear();
    let targetMonth = pureDate.getUTCMonth() + 1;
    let targetDay = pureDate.getUTCDate();
    
    let fmMonth = targetMonth < 10 ? "0" + targetMonth : targetMonth;
    let fmDay = targetDay < 10 ? "0" + targetDay : targetDay;
    
    let exactEndOfDayStr = `${targetYear}-${fmMonth}-${fmDay}T23:59:59`;
    let offsetStr = Utilities.formatDate(dateObj, tz, "Z"); 
    let cutoffEpoch = new Date(`${exactEndOfDayStr}${offsetStr}`).getTime();
    let displayString = `${fmDay}/${fmMonth}/${targetYear}`;
    
    return { display: displayString, cutoffTime: cutoffEpoch };
  }

  let countedOrders =[];
  for(let i = 1; i < data.length; i++) {
    if(statusIdx !== -1 && data[i][statusIdx] === "counted" && countedDateIdx !== -1 && data[i][countedDateIdx]) {
       let cd = new Date(data[i][countedDateIdx]);
       if(!isNaN(cd.getTime())) {
         let rawSubtotalString = (subIdx !== -1 && data[i][subIdx]) ? data[i][subIdx].toString().replace(/[^\d.-]/g, '') : "0";
         let cleanSubtotalNumber = parseFloat(rawSubtotalString) || 0;
         countedOrders.push({ id: data[i][idIdx], subtotal: cleanSubtotalNumber, countedTime: cd.getTime() });
       }
    }
  }

  let summaryData =[];
  for(let i = 1; i < data.length; i++) {
    let currWeekEnd = getWeekEnd(data[i][dateIdx]);
    if (!currWeekEnd) { summaryData.push(["", "", ""]); continue; }

    let nextRow = data[i+1];
    let nextWeekEnd = nextRow ? getWeekEnd(nextRow[dateIdx]) : null;

    if (!nextWeekEnd || currWeekEnd.cutoffTime !== nextWeekEnd.cutoffTime) {
       let weekEndTime = currWeekEnd.cutoffTime;
       let weekStartTime = weekEndTime - (7 * 24 * 60 * 60 * 1000); 
       let sum = 0;
       let ids =[];
       let uniqueIds = new Set(); 

       for(let co of countedOrders) {
          if(co.countedTime > weekStartTime && co.countedTime <= weekEndTime) {
             if (!uniqueIds.has(co.id)) { uniqueIds.add(co.id); sum += co.subtotal; ids.push(co.id); }
          }
       }
       
       // 🔥 DYNAMIC CHARGE LOGIC 🔥
       let charge = 0;
       if (BILLING_MODE === "FIXED") {
           charge = uniqueIds.size * FIXED_FEE_PER_ORDER; // Charge per order ID
       } else {
           charge = sum * CLIENT_PERCENTAGE; // Charge percentage of revenue
       }
       
       let csv = ids.length > 0 ? ids.join(", ") : "No counted orders this week";
       summaryData.push([currWeekEnd.display, charge, csv]); 
    } else {
       summaryData.push(["", "", ""]);
    }
  }

  sheet.getRange(2, weekEndIdx + 1, summaryData.length, 3).setValues(summaryData);
}

function RUN_ME_ONCE_TO_SETUP() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetLocale('en_GB');
  
  const chargeHeaderName = BILLING_MODE === "FIXED" 
      ? `Client Charge (${FIXED_FEE_PER_ORDER} Fixed)` 
      : `Client Charge (${CLIENT_PERCENTAGE * 100}%)`;

  let productsSheet = ss.getSheetByName("Products");
  if (!productsSheet) productsSheet = ss.insertSheet("Products");
  const pHeaders =["id", "in_stock", "name", "price", "original_price", "sold", "show_sold", "type", "sub_type", "tags", "images", "description", "colors", "sizes", "delivery_days", "keywords"];
  if (productsSheet.getLastRow() === 0) productsSheet.getRange(1, 1, 1, pHeaders.length).setValues([pHeaders]);

  let rawSheet = ss.getSheetByName("RawOrders");
  if (!rawSheet) rawSheet = ss.insertSheet("RawOrders");
  const rHeaders =["Order ID", "Date", "Name", "Phone", "Address", "Special Note", "Order Details", "Image Links", "Subtotal", "Total Price", "IP Info"];
  if (rawSheet.getLastRow() === 0) rawSheet.getRange(1, 1, 1, rHeaders.length).setValues([rHeaders]);

  let crmSheet = ss.getSheetByName("CRM");
  if (!crmSheet) crmSheet = ss.insertSheet("CRM");
  const crmHeaders =["Order ID", "Timestamp", "Customer Name", "Phone", "Address", "Order Note", "Order Details", "Image Links", "Subtotal", "Total Price", "Security & IP Info", "Status", "Admin Note", "Tracking ID", "Last Updated", "Counted Status", "Counted Date", "Week End Date", chargeHeaderName, "Counted Order IDs"];
  if (crmSheet.getLastRow() === 0) crmSheet.getRange(1, 1, 1, crmHeaders.length).setValues([crmHeaders]);

  SpreadsheetApp.flush();
  updateWeeklySummary(crmSheet);

  const data = crmSheet.getDataRange().getValues();
  if (data.length > 1) {
    const headers = data[0];
    const statusCol = headers.indexOf("Status");
    const updatedCol = headers.indexOf("Last Updated");
    const countedStatusCol = headers.indexOf("Counted Status");
    const countedDateCol = headers.indexOf("Counted Date");

    for (let i = 1; i < data.length; i++) {
       if (statusCol !== -1 && countedStatusCol !== -1) {
         if (data[i][statusCol] === "Delivered" && data[i][countedStatusCol] !== "counted") {
            crmSheet.getRange(i + 1, countedStatusCol + 1).setValue("counted");
            let pastDate = (updatedCol !== -1 && data[i][updatedCol]) ? new Date(data[i][updatedCol]) : new Date(data[i][1]); 
            if(!isNaN(pastDate.getTime()) && countedDateCol !== -1) {
              crmSheet.getRange(i + 1, countedDateCol + 1).setValue(pastDate);
            }
         } else if (data[i][statusCol] !== "Delivered" && !data[i][countedStatusCol]) {
            crmSheet.getRange(i + 1, countedStatusCol + 1).setValue("uncounted");
         }
       }
    }
  }
  SpreadsheetApp.flush();
  updateWeeklySummary(crmSheet); 
  SpreadsheetApp.getUi().alert("✅ Setup Complete!");
}
// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
let currentPdfBytes = null;
let croppedPdfBytes = null;
let skuData = {};
let partnerData = {};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const cropHeightSlider = document.getElementById('cropHeightSlider');
const heightVal = document.getElementById('heightVal');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const searchBar = document.getElementById('searchBar');
const reportTableBody = document.getElementById('reportTableBody');
const skuCountBadge = document.getElementById('skuCountBadge');
const partnerTableBody = document.getElementById('partnerTableBody');
const partnerCountBadge = document.getElementById('partnerCountBadge');
const previewGrid = document.getElementById('previewGrid');

// Drag and drop event listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handleFile(files[0]);
    } else {
        alert('Please drop a valid PDF file.');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Reset logic
resetBtn.addEventListener('click', resetApp);

// Slider height adjustment logic
cropHeightSlider.addEventListener('input', (e) => {
    heightVal.textContent = e.target.value + '%';
});

cropHeightSlider.addEventListener('change', async (e) => {
    if (!currentPdfBytes) return;
    showLoading('Cropping PDF and updating previews...');
    try {
        const cropVal = parseInt(e.target.value, 10);
        croppedPdfBytes = await cropPDF(currentPdfBytes.slice(0), cropVal);
        await renderPreviews(croppedPdfBytes.slice(0));
        showSuccess('PDF Cropped successfully!');
    } catch (err) {
        console.error(err);
        showSuccess('Error adjusting crop height.');
    }
});

// Download logic
downloadBtn.addEventListener('click', () => {
    if (!croppedPdfBytes) return;
    const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cropped_Shipping_Labels.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Search and filter logic
searchBar.addEventListener('input', () => {
    renderSKUTable(skuData, searchBar.value.trim());
});

// Process uploaded file
async function handleFile(file) {
    resetApp();
    showLoading('Reading PDF file...');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdfBytes = new Uint8Array(arrayBuffer);
        
        showLoading('Parsing text & analyzing labels...');
        const parsed = await parsePDF(currentPdfBytes.slice(0));
        skuData = parsed.skuMap;
        partnerData = parsed.partnerMap;
        
        renderSKUTable(skuData);
        renderPartnerTable(partnerData);
        
        showLoading('Cropping shipping labels...');
        const initialCropHeight = parseInt(cropHeightSlider.value, 10);
        croppedPdfBytes = await cropPDF(currentPdfBytes.slice(0), initialCropHeight);
        
        showLoading('Generating previews...');
        await renderPreviews(croppedPdfBytes.slice(0));
        
        // Enable inputs & controls
        cropHeightSlider.disabled = false;
        downloadBtn.disabled = false;
        resetBtn.disabled = false;
        searchBar.disabled = false;
        
        showSuccess(`Processed ${Object.keys(skuData).length} unique SKUs successfully!`);
    } catch (err) {
        console.error(err);
        showSuccess('An error occurred while processing the PDF.');
        statusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
        statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        statusBadge.style.color = 'var(--danger)';
        statusText.textContent = 'Error: ' + err.message;
    }
}

// Group PDF.js text items into lines based on Y coordinate
function getLinesFromItems(items) {
    const tolerance = 5; // tolerance for group vertical items
    const rows = [];
    for (const item of items) {
        if (!item.str.trim()) continue;
        const y = item.transform[5];
        const x = item.transform[4];
        let added = false;
        for (const row of rows) {
            if (Math.abs(row.y - y) < tolerance) {
                row.items.push({ text: item.str, x });
                added = true;
                break;
            }
        }
        if (!added) {
            rows.push({ y, items: [{ text: item.str, x }] });
        }
    }
    
    rows.sort((a, b) => b.y - a.y);
    
    const lineStrings = [];
    for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        lineStrings.push(row.items.map(it => it.text).join(" "));
    }
    return lineStrings;
}

// Parse PDF to find SKU wise details and Partner wise details
async function parsePDF(pdfData) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const skuMap = {};
    const partnerMap = {};
    
    // Regular expression matching Meesho SKUs (allowing spaces) and product details table format
    const skuPattern = /^(.*?)\s+(Free\s+Size|Size\s+\w+|[A-Z0-9\-]+)\s+(\d+)\s+([A-Za-z]+)\s+(\d{15,20}_\d+)$/i;
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = getLinesFromItems(textContent.items);
        
        let foundSku = false;
        let qty = 1; // Default
        
        // SKU Extraction
        for (const line of lines) {
            const match = line.trim().match(skuPattern);
            if (match) {
                const sku = match[1].trim();
                qty = parseInt(match[3], 10);
                if (!skuMap[sku]) {
                    skuMap[sku] = { qty: 0, orders: 0 };
                }
                skuMap[sku].qty += qty;
                skuMap[sku].orders += 1;
                foundSku = true;
                break;
            }
        }
        
        // Fallback simple SKU parsing
        if (!foundSku) {
            let headerIdx = -1;
            for (let j = 0; j < lines.length; j++) {
                if (lines[j].toLowerCase().includes('sku') && lines[j].toLowerCase().includes('size') && lines[j].toLowerCase().includes('qty')) {
                    headerIdx = j;
                    break;
                }
            }
            if (headerIdx !== -1 && headerIdx + 1 < lines.length) {
                const parts = lines[headerIdx + 1].trim().split(/\s+/);
                if (parts.length >= 3) {
                    const sku = parts[0].trim();
                    let qtyIndex = 2;
                    if (parts[1].toLowerCase() === 'free' && parts[2].toLowerCase() === 'size') {
                        qtyIndex = 3;
                    }
                    const parsedQty = parseInt(parts[qtyIndex], 10);
                    if (sku && !isNaN(parsedQty)) {
                        qty = parsedQty;
                        if (!skuMap[sku]) {
                            skuMap[sku] = { qty: 0, orders: 0 };
                        }
                        skuMap[sku].qty += qty;
                        skuMap[sku].orders += 1;
                        foundSku = true;
                    }
                }
            }
        }
        
        // Delivery Partner Detection
        let partner = 'Other/Unknown';
        for (const line of lines) {
            const l = line.toLowerCase();
            if (l.includes('shadowfax')) {
                partner = 'Shadowfax';
                break;
            } else if (l.includes('delhivery')) {
                partner = 'Delhivery';
                break;
            } else if (l.includes('valmoplus') || l.includes('valmo')) {
                partner = 'Valmo';
                break;
            }
        }
        
        // Count for Delivery Partner
        if (!partnerMap[partner]) {
            partnerMap[partner] = { qty: 0, orders: 0 };
        }
        partnerMap[partner].qty += qty;
        partnerMap[partner].orders += 1;
    }
    return { skuMap, partnerMap };
}

// Render SKU Report Table
function renderSKUTable(data, filterQuery = '') {
    reportTableBody.innerHTML = '';
    const query = filterQuery.toLowerCase();
    
    let totalQty = 0;
    let totalOrders = 0;
    let skuCount = 0;
    
    const sortedSkus = Object.keys(data).sort();
    
    for (const sku of sortedSkus) {
        if (query && !sku.toLowerCase().includes(query)) continue;
        
        const item = data[sku];
        totalQty += item.qty;
        totalOrders += item.orders;
        skuCount++;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="sku-cell">${sku}</td>
            <td class="qty-cell">${item.qty}</td>
            <td>${item.orders}</td>
        `;
        reportTableBody.appendChild(row);
    }
    
    skuCountBadge.textContent = `${skuCount} SKU${skuCount !== 1 ? 's' : ''}`;
    
    if (skuCount > 0) {
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td>TOTAL</td>
            <td class="qty-cell">${totalQty}</td>
            <td>${totalOrders}</td>
        `;
        reportTableBody.appendChild(totalRow);
    } else {
        reportTableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <div>No SKUs match search.</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Render Delivery Partner Table
function renderPartnerTable(data) {
    partnerTableBody.innerHTML = '';
    
    let totalQty = 0;
    let totalOrders = 0;
    let partnerCount = 0;
    
    const sortedPartners = Object.keys(data).sort();
    
    for (const partner of sortedPartners) {
        const item = data[partner];
        totalQty += item.qty;
        totalOrders += item.orders;
        partnerCount++;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="sku-cell" style="color: var(--secondary);">${partner}</td>
            <td class="qty-cell">${item.qty}</td>
            <td>${item.orders}</td>
        `;
        partnerTableBody.appendChild(row);
    }
    
    partnerCountBadge.textContent = `${partnerCount} Partner${partnerCount !== 1 ? 's' : ''}`;
    
    if (partnerCount > 0) {
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td>TOTAL</td>
            <td class="qty-cell">${totalQty}</td>
            <td>${totalOrders}</td>
        `;
        partnerTableBody.appendChild(totalRow);
    } else {
        partnerTableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-state">
                        <div class="empty-state-icon">🚚</div>
                        <div>No data available.</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Crop the top portion of the PDF using PDF-lib
async function cropPDF(pdfBytes, cropPercentage) {
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    for (const page of pages) {
        const { width, height } = page.getSize();
        const keepRatio = cropPercentage / 100;
        const cropY = height * (1 - keepRatio);
        const cropHeight = height * keepRatio;
        
        page.setCropBox(0, cropY, width, cropHeight);
    }
    
    return await pdfDoc.save();
}

// Render cropped previews on screen
async function renderPreviews(pdfBytes) {
    previewGrid.innerHTML = '';
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        
        const card = document.createElement('div');
        card.className = 'preview-card';
        
        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'preview-canvas-wrapper';
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        canvasWrapper.appendChild(canvas);
        card.appendChild(canvasWrapper);
        
        const info = document.createElement('div');
        info.className = 'preview-info';
        info.innerHTML = `
            <span>Shipping Label Preview</span>
            <span class="page-number">Page ${i}</span>
        `;
        card.appendChild(info);
        previewGrid.appendChild(card);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;
    }
}

// Helper styling state setters
function showLoading(text) {
    statusBadge.style.display = 'flex';
    statusBadge.className = 'status-badge loading';
    statusText.textContent = text;
}

function showSuccess(text) {
    statusBadge.style.display = 'flex';
    statusBadge.className = 'status-badge success';
    statusText.textContent = text;
}

// Reset UI
function resetApp() {
    currentPdfBytes = null;
    croppedPdfBytes = null;
    skuData = {};
    partnerData = {};
    
    fileInput.value = '';
    statusBadge.style.display = 'none';
    cropHeightSlider.disabled = true;
    cropHeightSlider.value = 46;
    heightVal.textContent = '46%';
    downloadBtn.disabled = true;
    resetBtn.disabled = true;
    searchBar.disabled = true;
    searchBar.value = '';
    skuCountBadge.textContent = '0 SKUs';
    partnerCountBadge.textContent = '0 Partners';
    
    reportTableBody.innerHTML = `
        <tr>
            <td colspan="3">
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div>Upload a PDF to view the SKU reports here</div>
                </div>
            </td>
        </tr>
    `;
    
    partnerTableBody.innerHTML = `
        <tr>
            <td colspan="3">
                <div class="empty-state">
                    <div class="empty-state-icon">🚚</div>
                    <div>Upload a PDF to view partner reports</div>
                </div>
            </td>
        </tr>
    `;
    
    previewGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; width: 100%;">
            <div class="empty-state-icon">👁️</div>
            <div>Page previews will be generated here</div>
        </div>
    `;
}

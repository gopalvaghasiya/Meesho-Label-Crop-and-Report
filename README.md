# Meesho Label Crop & SKU Report Analyzer

A high-fidelity, fully client-side web application tool to crop Meesho PDF shipping labels and analyze orders to generate SKU-wise and Delivery Partner-wise summaries in real-time.

**🔗 GitHub Repository:** [gopalvaghasiya/Meesho-Label-Crop-and-Report](https://github.com/gopalvaghasiya/Meesho-Label-Crop-and-Report)  
**⚡ Live Demo Tool:** [Launch Application on GitHub Pages](https://gopalvaghasiya.github.io/Meesho-Label-Crop-and-Report/)

## Features

- 📥 **Drag-and-Drop Upload:** Drop any multi-page Meesho shipping label PDF directly into the browser.
- ✂️ **Automatic PDF Cropping:** Crops each page to only keep the top shipping label & product details section (removing the invoice portion).
- 🎚️ **Adjustable Cutoff Height:** Use the slider controls to dynamically adjust the crop percentage in real-time (defaults to 46%).
- 📊 **SKU Order Summary:** Automatically extracts and aggregates order quantities and count for each unique SKU.
- 🚚 **Delivery Partner Summary:** Auto-detects delivery partners (e.g. Valmo, Shadowfax, Delhivery) and aggregates order metrics per partner.
- 🔍 **Instant Search:** Filter SKU table dynamically with real-time text query.
- ⚡ **Download Cropped PDF:** Save and download the compiled cropped PDF instantly.
- 🔒 **100% Client-Side:** Processes everything directly in the browser—no data is sent to a server.

## Technologies Used

- **Frontend:** Semantic HTML5, CSS3 Custom Properties (Vanilla CSS) with modern glassmorphic theme.
- **PDF Extraction:** [PDF.js](https://mozilla.github.io/pdf.js/) (by Mozilla) for client-side text extraction and PDF preview rendering.
- **PDF Manipulation:** [pdf-lib](https://pdf-lib.js.org/) for loading, page cropping, and compiling bytes client-side.

## How to Run Locally

Since this tool runs completely on the client-side, you can open it directly:
1. Clone the repository.
2. Double-click `index.html` to open it in any web browser.
3. Drop your shipping label PDF and start analysis!

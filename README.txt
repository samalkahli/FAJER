FAJER separated project

Files:
- index.html: public gallery
- admin.html: admin dashboard
- login.html: admin login
- css/: separated styles
- js/: shared Firebase config and page scripts

Upload the whole folder while preserving the css/ and js/ paths.
For local testing, do not open the HTML files by double-clicking them as file://. Use VS Code Live Server or another local HTTP server, then open the localhost URL.
The data collections remain:
- embroidery: categories, products, reviews
- printing: printCategories, printProducts, printReviews

The public page loads the selected mode in parallel and caches each mode after its first load.
The admin page keeps the existing functions but uses the active mode collections.

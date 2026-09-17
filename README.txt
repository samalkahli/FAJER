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

The public page fetches categories on store entry, products on category entry, and reviews on demand.
Requests are deduplicated and cached in memory for 60 seconds. Reviews use cursor pagination.
Read DEPLOY-AR.md before deploying, especially the Firebase rules and Node.js 22 requirements.
Read AUDIT-AR.md for findings, verification scope and remaining operational requirements.
No live database content was changed while preparing this version.

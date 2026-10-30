// Impression du certificat : gestionnaire externe (pas d'attribut onclick, requis par la CSP).
document.getElementById('print-certificate')?.addEventListener('click', () => window.print());

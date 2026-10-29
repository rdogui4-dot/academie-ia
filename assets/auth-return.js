// Recover email links sent to the historical formations callback URL.
const params = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has('access_token') || hash.has('error_description') || params.has('code')) {
  const target = new URL('connexion.html', location.href);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
}

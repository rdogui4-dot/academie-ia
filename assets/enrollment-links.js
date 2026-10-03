'use strict';
(()=>{const c=window.ACADEMY_CONFIG||{},n=Number(new URLSearchParams(location.search).get('niveau'));
 for(const a of document.querySelectorAll('[data-enroll]')){
 const level=Number(a.dataset.enroll)||n;
 a.href=c.formLinks?.[level]||c.formUrl||'https://docs.google.com/forms/d/e/1FAIpQLSd3wZY241Mu27VVJp8P6v5FfnV8U1hSl3PwY0ojaPLGNAHLLA/viewform';a.target='_blank';a.rel='noopener';
 }
})();

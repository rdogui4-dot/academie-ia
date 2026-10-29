// Calculs de gestion, jamais une déclaration fiscale ou un solde bancaire certifié.
export const kinds={sale:'Encaissement client',refund:'Remboursement client',expense:'Dépense',tax:'Impôt payé',social:'Cotisation sociale payée',owner_draw:'Rémunération / prélèvement dirigeant',funding:'Apport / solde initial documenté'};
export function summarize(entries,s){
 const r={sales:0,refunds:0,fees:0,vat:0,expenses:0,taxes:0,social:0,draws:0,funding:0,count:0};
 for(const e of entries){if(e.voided_at)continue;r.count++;const a=Number(e.amount),v=Number(e.vat),f=Number(e.fee);
 if(e.kind==='sale'){r.sales+=a;r.fees+=f;r.vat+=v;}else if(e.kind==='refund'){r.refunds+=a;r.vat-=v;}else if(e.kind==='expense')r.expenses+=a;else if(e.kind==='tax')r.taxes+=a;else if(e.kind==='social')r.social+=a;else if(e.kind==='owner_draw')r.draws+=a;else if(e.kind==='funding')r.funding+=a;}
 r.netSales=r.sales-r.refunds;r.revenue=r.netSales-r.vat;
 r.cash=r.netSales+r.funding-r.fees-r.expenses-r.taxes-r.social-r.draws;
 r.taxEstimate=s.tax_mode==='vat'?Math.max(0,r.vat):Math.round(Math.max(0,r.revenue)*Number(s.tax_rate)/100);
 r.taxRemaining=Math.max(0,r.taxEstimate-r.taxes);
 r.socialRemaining=Math.max(0,Number(s.social_budget)-r.social);
 r.familyRemaining=Math.max(0,Number(s.family_target)-r.draws);
 r.available=r.cash-r.taxRemaining-r.socialRemaining-r.familyRemaining-Number(s.extra_tax_reserve)-Number(s.business_reserve);
 return r;
}
export function forecast(s,sales){
 const revenue=s.tax_mode==='vat'?sales/(1+Number(s.tax_rate)/100):sales;
 const tax=s.tax_mode==='vat'?sales-revenue:sales*Number(s.tax_rate)/100;
 return Math.round(sales-sales*Number(s.commission_rate)/100-tax-sales*Number(s.variable_rate)/100-Number(s.fixed_budget)-Number(s.family_target)-Number(s.social_budget)-Number(s.extra_tax_reserve)-Number(s.business_reserve));
}
export function csvCell(v){const t=String(v??'');return '"'+(/^[\s]*[=+@-]/.test(t)?"'"+t:t).replaceAll('"','""')+'"';}
export function ledgerCsv(entries){return '\uFEFF'+[['Date','Nature','Libellé','Référence','Canal','Niveau','Montant XOF','Commission XOF','TVA incluse XOF','Saisi le','Auteur','Annulé le','Auteur annulation','Motif'],...entries.map(e=>[e.occurred_on,kinds[e.kind],e.description,e.reference,e.channel,e.level,e.amount,e.fee,e.vat,e.created_at,e.created_by,e.voided_at,e.voided_by,e.void_reason])].map(r=>r.map(csvCell).join(';')).join('\r\n');}

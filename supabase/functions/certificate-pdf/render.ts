import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import QRCode from 'npm:qrcode@1.5.4';
import {fontBase64,logoBase64} from './assets.ts';
export interface Certificate {id:string;full_name:string;iuid:string;level:number;issued_at:string;edited_at:string;document_version:number;specialty_title:string|null}
const titles=['','Fondamentaux de l’IA générative','Prompts structurés et productivité augmentée','IA générative avancée : RAG, agents et fine-tuning','IA générative appliquée par métier'];
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function renderCertificate(c:Certificate,verificationBase:string,specimen=false):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const date=new Date(c.edited_at||c.issued_at);pdf.setCreationDate(date);pdf.setModificationDate(date);pdf.setTitle('Certificat de réussite — Académie IA Générative');pdf.setAuthor('Académie IA Générative');
 const font=await pdf.embedFont(bytes(fontBase64),{subset:true});const page=pdf.addPage([841.8898,595.2756]);
 const navy=rgb(.055,.11,.20),gold=rgb(.69,.49,.19),muted=rgb(.30,.35,.41),white=rgb(1,1,1);
 page.drawRectangle({x:0,y:0,width:841.8898,height:595.2756,color:rgb(.99,.98,.95)});
 page.drawRectangle({x:23,y:23,width:795.8898,height:549.2756,borderColor:gold,borderWidth:1.3});
 page.drawRectangle({x:34,y:458,width:773.8898,height:103,color:navy});
 const logo=await pdf.embedPng(bytes(logoBase64));const scale=Math.min(290/logo.width,90/logo.height);page.drawImage(logo,{x:(841.8898-logo.width*scale)/2,y:464,width:logo.width*scale,height:logo.height*scale});
 function center(text:string,y:number,size:number,color=navy,maxWidth=735){
  text=text.normalize('NFC').replace(/\s+/g,' ').trim();
  for(const ch of text){if(!font.getCharacterSet().includes(ch.codePointAt(0)!))throw Error('Caractère non pris en charge : correction typographique requise');}
  while(font.widthOfTextAtSize(text,size)>maxWidth&&size>9)size-=.5;
  if(font.widthOfTextAtSize(text,size)>maxWidth)throw Error('Texte trop long pour le certificat');
  page.drawText(text,{x:(841.8898-font.widthOfTextAtSize(text,size))/2,y,size,font,color});
 }
 center('CERTIFICAT DE RÉUSSITE',416,29);
 center('L’Académie IA Générative atteste la réussite de',381,12,muted);
 center(c.full_name,337,28);center('IUID : '+c.iuid,310,11,muted);
 center('N'+c.level+' — '+titles[c.level],273,17);
 if(c.specialty_title)center('Spécialité : '+c.specialty_title,246,13,gold);
 center('Évaluations et projet validés par un formateur habilité.',217,11,muted);
 const dateLabel=(s:string)=>new Date(s).toLocaleDateString('fr-FR',{timeZone:'UTC'});
 center('Délivré le '+dateLabel(c.issued_at)+' • Édition '+c.document_version+' du '+dateLabel(c.edited_at||c.issued_at),188,10,muted);
 const verify=new URL('verification.html',verificationBase);verify.searchParams.set('id',c.id);
 const qr=await QRCode.toDataURL(verify.href,{errorCorrectionLevel:'M',margin:4,width:220});const qrImage=await pdf.embedPng(qr);page.drawImage(qrImage,{x:61,y:61,width:91,height:91});
 page.drawText('Vérifier le registre',{x:57,y:47,size:8,font,color:muted});
 page.drawText('La direction pédagogique',{x:515,y:115,size:12,font,color:navy});
 page.drawText('Académie IA Générative',{x:515,y:94,size:10,font,color:muted});
 center('Certificat : '+c.id,66,9,muted,480);
 if(specimen){center('SPÉCIMEN — SANS VALEUR DE CERTIFICATION',162,13,rgb(.7,.1,.1));}
 return pdf.save();
}

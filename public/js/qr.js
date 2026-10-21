// Vis en stor QR-kode på skærmen (fx invitationslink), så en anden kan scanne den.
import qrcode from './vendor/qrcode.js';
import { esc } from './core.js';

export function showQR(url, title, sub = 'Scan koden med telefonens kamera') {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const box = document.createElement('div');
  box.className = 'qrmodal';
  box.innerHTML = `<div class="qrcard" role="dialog" aria-label="${esc(title)}">
    <b>${esc(title)}</b>
    <div class="qrimg">${qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true })}</div>
    <p>${esc(sub)}</p>
    <button class="btn primary">Luk</button></div>`;
  const close = () => box.remove();
  box.onclick = (e) => { if (e.target === box || e.target.closest('button')) close(); };
  document.body.appendChild(box);
}

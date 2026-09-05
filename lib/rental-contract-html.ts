/**
 * Contrat de location RAVE — source de vérité HTML
 * (client signature, snapshot serveur, aperçu loueur / dashboard).
 *
 * Contrats perso : markdown léger
 *   ## Titre section   → titre vert (comme le contrat RAVE)
 *   - item             → puce
 *   **gras**           → gras
 *   lignes normales    → paragraphes
 */

export const RAVE_CONTRACT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111827;background:#fff;padding:16px}
.page{background:#fff;border-radius:12px;border:1px solid #E5E7EB;padding:28px 24px;max-width:600px;margin:0 auto;overflow:hidden}
.header{text-align:center;border-bottom:2px solid #059669;padding-bottom:18px;margin-bottom:20px}
.logo{font-size:28px;font-weight:900;color:#047857;letter-spacing:2px}
.logo-sub{font-size:11px;color:#374151;letter-spacing:1px;margin-top:2px;font-weight:600}
.doc-title{font-size:17px;font-weight:700;color:#111827;margin-top:12px}
.ref{font-size:11px;color:#374151;margin-top:4px;font-weight:500}
.badge{display:inline-block;background:#D1FAE5;color:#064E3B;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;margin-top:8px;border:1px solid #059669}
.section{margin-top:18px;clear:both}
.section-title{display:block;font-size:13px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #D1FAE5;padding-bottom:6px;margin-bottom:12px;line-height:1.3;position:relative;z-index:1}
.party{background:#F3F4F6;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #E5E7EB}
.party-label{font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.party-name{font-size:14px;font-weight:700;color:#111827}
.party-info{font-size:12px;color:#1F2937;margin-top:2px}
.vehicle-box{background:#ECFDF5;border:1px solid #059669;border-radius:10px;padding:14px;text-align:center;margin-bottom:8px}
.vehicle-name{font-size:16px;font-weight:800;color:#111827;word-break:break-word}
.vehicle-cat{font-size:12px;color:#065F46;margin-top:2px;font-weight:700}
.vehicle-km{font-size:11px;color:#374151;margin-top:4px;font-weight:500}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px;margin-bottom:8px}
.info-card{min-width:0;background:#F9FAFB;border:1px solid #D1D5DB;border-radius:8px;padding:10px;overflow:hidden}
.info-label{display:block;font-size:10px;color:#374151;font-weight:700;text-transform:uppercase;margin-bottom:4px;line-height:1.2}
.info-value{display:block;font-size:13px;font-weight:700;color:#111827;line-height:1.35;word-break:break-word;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;margin:8px 0}
table td{padding:6px 0;font-size:12px;color:#111827;border-bottom:1px solid #E5E7EB;vertical-align:top;word-break:break-word}
table .r{text-align:right;font-weight:700;white-space:nowrap;padding-left:8px;color:#111827}
.total-row{background:#D1FAE5;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0;border:2px solid #047857}
.total-label{font-size:14px;font-weight:800;color:#064E3B;flex-shrink:0}
.total-val{font-size:16px;font-weight:800;color:#064E3B;text-align:right;word-break:break-word}
.article{font-size:12px;color:#1F2937;line-height:1.65;margin-bottom:6px}
.article b{color:#111827}
ul{padding-left:16px;margin:6px 0}
li{font-size:12px;color:#1F2937;margin-bottom:3px;line-height:1.55}
.custom-body{margin-top:8px;color:#111827}
.custom-body p{font-size:13px;color:#111827;line-height:1.7;margin-bottom:8px}
.signature-box{background:#F9FAFB;border:2px dashed #9CA3AF;border-radius:10px;padding:16px;text-align:center;margin-top:12px}
.sig-label{font-size:10px;color:#374151;text-transform:uppercase;font-weight:700}
.sig-name{font-size:15px;font-weight:800;color:#111827;margin-top:4px}
.sig-date{font-size:11px;color:#1F2937;margin-top:2px;font-weight:500}
.sig-img{max-width:200px;height:auto;margin:8px auto 4px;display:block}
.footer{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid #E5E7EB}
.footer-text{font-size:10px;color:#4B5563;font-weight:500}
.summary{background:#F3F4F6;border:1px solid #D1D5DB;border-radius:10px;padding:14px;margin-top:16px}
.summary-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:6px 0;font-size:12px}
.summary-label{color:#374151;flex:0 0 auto;max-width:38%;line-height:1.35;font-weight:600}
.summary-value{color:#111827;font-weight:700;text-align:right;flex:1;min-width:0;line-height:1.35;word-break:break-word;overflow-wrap:anywhere}
.field{color:#047857;font-weight:800}
@media (max-width:360px){
  .info-grid{grid-template-columns:1fr}
  .page{padding:20px 14px}
}
@media print{
  body{background:#fff;padding:0;color:#000}
  .page{box-shadow:none;border:none;max-width:none;padding:12px}
  .section-title,.logo,.field,.vehicle-cat{color:#065F46 !important}
  .total-row{background:#D1FAE5 !important;border:2px solid #047857 !important}
  .total-label,.total-val{color:#064E3B !important}
  .info-label,.party-label,.summary-label,.sig-label,.footer-text,.logo-sub{color:#374151 !important}
  .info-value,.party-name,.summary-value,.article,li,table td,.custom-body p{color:#111827 !important}
}
`.trim();

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/**
 * Convertit le texte loueur (markdown léger) en HTML stylé.
 * Les titres ## deviennent des .section-title verts.
 */
export function formatCustomContractBody(raw: string): string {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Si le loueur a déjà collé du HTML (avec section-title), on l'encapsule tel quel (sanitisation soft)
  if (/<\s*(div|h[1-6]|p|ul|li|table)\b/i.test(text)) {
    return `<div class="custom-body">${text}</div>`;
  }

  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    // ## Titre  OR  Article X — ...
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const article = trimmed.match(/^(Article\s+\d+[^\n]*)$/i);
    if (h2 || article) {
      closeList();
      const title = h2 ? h2[1] : article![1];
      out.push(`<div class="section"><div class="section-title">${inlineFormat(title)}</div>`);
      continue;
    }

    // # Titre principal
    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      closeList();
      out.push(`<div class="doc-title" style="text-align:left;margin:12px 0">${inlineFormat(h1[1])}</div>`);
      continue;
    }

    // - puce
    if (/^[-•]\s+/.test(trimmed)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineFormat(trimmed.replace(/^[-•]\s+/, ""))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p class="article">${inlineFormat(trimmed)}</p>`);
  }
  closeList();

  return `<div class="custom-body">${out.join("\n")}</div>`;
}

export type RentalContractParams = {
  ref: string;
  contractDate: string;
  loueurName: string;
  clientName: string;
  clientInfo?: string;
  vehicleName: string;
  vehicleMeta?: string;
  vehicleKm?: string;
  startLabel: string;
  endLabel: string;
  days: number;
  pickupLocation?: string;
  pricePerDayLabel: string;
  priceRowsHtml?: string;
  totalLabel: string;
  paymentNote?: string;
  insuranceArticle?: string;
  signatureHtml?: string;
  /** Contrat perso markdown / texte */
  customBody?: string | null;
  isCustom?: boolean;
  /** Mode aperçu loueur (placeholders) */
  previewMode?: boolean;
};

function wrapPage(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${RAVE_CONTRACT_CSS}</style></head><body><div class="page">
${inner}
</div></body></html>`;
}

/** Contrat RAVE par défaut — même rendu que la signature client */
export function buildDefaultRentalContractHtml(p: RentalContractParams): string {
  const daysLabel = `${p.days} jour${p.days > 1 ? "s" : ""}`;
  const priceRows =
    p.priceRowsHtml ||
    `<tr><td>Location (${esc(daysLabel)})</td><td class="r">${esc(p.totalLabel)}</td></tr>`;

  const insurance =
    p.insuranceArticle ||
    "Les conditions d'assurance sont celles définies par le Professionnel. En cas de sinistre imputable au Client, une franchise pourra être retenue sur la caution.";

  const payment =
    p.paymentNote ||
    "Paiement directement auprès du loueur. Aucun paiement en ligne.";

  const sig =
    p.signatureHtml ||
    `<div class="signature-box">
  <div class="sig-label">Signé électroniquement par</div>
  <div class="sig-name">${esc(p.clientName)}</div>
  <div class="sig-date">${esc(p.contractDate)}</div>
</div>`;

  const body = `
<div class="header">
  <div class="logo">RAVE</div>
  <div class="logo-sub">LOCATION DE VÉHICULES — POLYNÉSIE FRANÇAISE</div>
  <div class="doc-title">Contrat de location de véhicule</div>
  <div class="ref">Réf. ${esc(p.ref)} — ${esc(p.contractDate)}</div>
  ${p.previewMode ? `<div class="badge">Aperçu — identique au contrat signé par le client</div>` : ""}
</div>

<div class="section">
  <div class="section-title">Parties contractantes</div>
  <div class="party">
    <div class="party-label">Le loueur (professionnel)</div>
    <div class="party-name">${esc(p.loueurName)}</div>
    <div class="party-info">Location de véhicules — Plateforme RAVE</div>
  </div>
  <div class="party">
    <div class="party-label">Le locataire (client)</div>
    <div class="party-name">${esc(p.clientName)}</div>
    ${p.clientInfo ? `<div class="party-info">${esc(p.clientInfo)}</div>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-title">Véhicule</div>
  <div class="vehicle-box">
    <div class="vehicle-name">${esc(p.vehicleName)}</div>
    ${p.vehicleMeta ? `<div class="vehicle-cat">${esc(p.vehicleMeta)}</div>` : ""}
    ${p.vehicleKm ? `<div class="vehicle-km">${esc(p.vehicleKm)}</div>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-title">Période de location</div>
  <div class="info-grid">
    <div class="info-card"><div class="info-label">Début</div><div class="info-value">${esc(p.startLabel)}</div></div>
    <div class="info-card"><div class="info-label">Fin</div><div class="info-value">${esc(p.endLabel)}</div></div>
    <div class="info-card"><div class="info-label">Durée</div><div class="info-value">${esc(daysLabel)}</div></div>
    <div class="info-card"><div class="info-label">Lieu</div><div class="info-value">${esc(p.pickupLocation || "—")}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Conditions financières</div>
  <table>
    <tr><td>Tarif de base / jour</td><td class="r">${esc(p.pricePerDayLabel)}</td></tr>
    ${priceRows}
  </table>
  <div class="total-row">
    <span class="total-label">Montant total</span>
    <span class="total-val">${esc(p.totalLabel)}</span>
  </div>
  <div class="article">${esc(payment)}</div>
</div>

<div class="section">
  <div class="section-title">Obligations du locataire</div>
  <ul>
    <li>Utiliser le véhicule conformément au Code de la route de Polynésie française</li>
    <li>Ne pas sous-louer ni prêter le véhicule à un tiers non déclaré</li>
    <li>Restituer le véhicule dans son état initial (usure normale acceptée)</li>
    <li>Signaler immédiatement tout sinistre, accident ou panne</li>
    <li>Être titulaire d'un permis de conduire en cours de validité</li>
  </ul>
</div>

<div class="section">
  <div class="section-title">Obligations du loueur</div>
  <ul>
    <li>Mettre à disposition un véhicule en bon état et conforme au descriptif</li>
    <li>Fournir les documents du véhicule (carte grise, assurance)</li>
    <li>Restituer la caution dans un délai raisonnable après le retour</li>
  </ul>
</div>

<div class="section">
  <div class="section-title">Assurance &amp; responsabilité</div>
  <div class="article">${esc(insurance)}</div>
</div>

<div class="section">
  <div class="section-title">Annulation</div>
  <div class="article">Toute annulation doit être signalée dans les meilleurs délais. Les conditions et frais d'annulation sont définis par le Professionnel.</div>
</div>

<div class="section">
  <div class="section-title">Droit applicable</div>
  <div class="article">Contrat soumis au droit de Polynésie française. En cas de litige, les parties rechercheront une solution amiable. À défaut, le Tribunal de Papeete sera compétent.</div>
</div>

<div class="section">
  <div class="section-title">Signature électronique</div>
  <div class="article">Ce contrat est signé électroniquement via la plateforme RAVE, ayant la même valeur juridique qu'une signature manuscrite.</div>
  ${sig}
</div>

<div class="footer">
  <div class="footer-text">Document généré automatiquement par RAVE — Location de véhicules — Polynésie française</div>
</div>`;

  return wrapPage(body);
}

/** Contrat personnalisé (corps formaté + en-tête RAVE + résumé réservation) */
export function buildCustomRentalContractHtml(p: RentalContractParams): string {
  const bodyHtml = formatCustomContractBody(p.customBody || "");
  const sig =
    p.signatureHtml ||
    `<div class="signature-box">
  <div class="sig-label">Signé électroniquement par</div>
  <div class="sig-name">${esc(p.clientName)}</div>
  <div class="sig-date">${esc(p.contractDate)}</div>
</div>`;

  const inner = `
<div class="header">
  <div class="logo">RAVE</div>
  <div class="logo-sub">LOCATION DE VÉHICULES — POLYNÉSIE FRANÇAISE</div>
  <div class="badge">Contrat personnalisé du loueur</div>
  <div class="ref">Réf. ${esc(p.ref)} — ${esc(p.contractDate)}</div>
</div>
<div class="summary">
  <div class="summary-row"><span class="summary-label">Loueur</span><span class="summary-value">${esc(p.loueurName)}</span></div>
  <div class="summary-row"><span class="summary-label">Client</span><span class="summary-value">${esc(p.clientName)}</span></div>
  <div class="summary-row"><span class="summary-label">Véhicule</span><span class="summary-value">${esc(p.vehicleName)}</span></div>
  <div class="summary-row"><span class="summary-label">Période</span><span class="summary-value">${esc(p.startLabel)}<br/>→ ${esc(p.endLabel)}</span></div>
  <div class="summary-row"><span class="summary-label">Total</span><span class="summary-value">${esc(p.totalLabel)}</span></div>
</div>
${bodyHtml}
<div class="section">
  <div class="section-title">Signature électronique</div>
  ${sig}
</div>
<div class="footer">
  <div class="footer-text">Contrat personnalisé fourni par le loueur via RAVE — ${esc(p.contractDate)}</div>
</div>`;

  return wrapPage(inner);
}

/** Aide rédaction (legacy) — l’UI utilise désormais une barre d’outils */
export const CUSTOM_CONTRACT_HINT = `Écrivez normalement, puis utilisez les boutons Titre, Gras et Liste.
L’aperçu montre ce que verra le client à la signature.`;

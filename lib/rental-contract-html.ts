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
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#f8f9fa;padding:16px}
.page{background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,.08);padding:28px 24px;max-width:600px;margin:0 auto}
.header{text-align:center;border-bottom:2px solid #4ECC8B;padding-bottom:18px;margin-bottom:20px}
.logo{font-size:28px;font-weight:900;color:#4ECC8B;letter-spacing:2px}
.logo-sub{font-size:11px;color:#9CA3AF;letter-spacing:1px;margin-top:2px}
.doc-title{font-size:17px;font-weight:700;color:#1a1a1a;margin-top:12px}
.ref{font-size:11px;color:#6B7280;margin-top:4px}
.badge{display:inline-block;background:#D1F2E3;color:#065F46;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;margin-top:8px}
.section{margin-top:18px}
.section-title{font-size:13px;font-weight:700;color:#4ECC8B;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #F3F4F6;padding-bottom:6px;margin-bottom:10px}
.party{background:#FAFAFA;border-radius:8px;padding:12px;margin-bottom:8px}
.party-label{font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.party-name{font-size:14px;font-weight:600;color:#1a1a1a}
.party-info{font-size:12px;color:#6B7280;margin-top:2px}
.vehicle-box{background:linear-gradient(135deg,#E8F8F0,#D1F2E3);border-radius:10px;padding:14px;text-align:center;margin-bottom:8px}
.vehicle-name{font-size:16px;font-weight:800;color:#1a1a1a}
.vehicle-cat{font-size:12px;color:#065F46;margin-top:2px}
.vehicle-km{font-size:11px;color:#6B7280;margin-top:4px}
.info-grid{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.info-card{flex:1;min-width:45%;background:#F9FAFB;border:1px solid #F3F4F6;border-radius:8px;padding:10px}
.info-label{font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase}
.info-value{font-size:13px;font-weight:600;color:#1a1a1a;margin-top:2px}
table{width:100%;border-collapse:collapse;margin:8px 0}
table td{padding:6px 0;font-size:12px;border-bottom:1px solid #F3F4F6}
table .r{text-align:right;font-weight:600}
.total-row{background:#4ECC8B;border-radius:8px;padding:12px;display:flex;justify-content:space-between;margin:10px 0}
.total-label{font-size:14px;font-weight:700;color:#1a1a1a}
.total-val{font-size:16px;font-weight:800;color:#1a1a1a}
.article{font-size:12px;color:#374151;line-height:1.6;margin-bottom:6px}
.article b{color:#1a1a1a}
ul{padding-left:16px;margin:6px 0}
li{font-size:12px;color:#374151;margin-bottom:3px;line-height:1.5}
.custom-body{margin-top:8px}
.custom-body p{font-size:13px;color:#1a1a1a;line-height:1.7;margin-bottom:8px}
.signature-box{background:#FAFAFA;border:2px dashed #E5E7EB;border-radius:10px;padding:16px;text-align:center;margin-top:12px}
.sig-label{font-size:10px;color:#9CA3AF;text-transform:uppercase;font-weight:600}
.sig-name{font-size:15px;font-weight:700;color:#1a1a1a;margin-top:4px}
.sig-date{font-size:11px;color:#6B7280;margin-top:2px}
.sig-img{max-width:200px;height:auto;margin:8px auto 4px;display:block}
.footer{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid #F3F4F6}
.footer-text{font-size:10px;color:#9CA3AF}
.summary{background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;padding:14px;margin-top:16px}
.summary-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.summary-label{color:#6B7280}
.summary-value{color:#1a1a1a;font-weight:600}
.field{color:#4ECC8B;font-weight:700}
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
  <div class="summary-row"><span class="summary-label">Période</span><span class="summary-value">${esc(p.startLabel)} → ${esc(p.endLabel)}</span></div>
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

/** Aide rédaction dashboard / app loueur */
export const CUSTOM_CONTRACT_HINT = `Utilisez ## pour un titre coloré (comme le contrat RAVE).

Exemple :
## Article 1 — Parties
Le Loueur : **Votre nom**
Le Locataire : …

## Article 2 — Conditions
- Restituer le véhicule propre
- Permis valide obligatoire

## Article 3 — Caution
Montant et modalités…`;

export const POST_11154_REFERENCE_MARKER = "data-um-post-11154-sources";

const references = [
  {
    id: 2,
    url: "https://pubmed.ncbi.nlm.nih.gov/41601564/",
    title: "How the gut microbiome shapes learning and memory: A comprehensive review",
    publication: "IBRO Neuroscience Reports (2025)",
  },
  {
    id: 4,
    url: "https://pubmed.ncbi.nlm.nih.gov/41684710/",
    title: "From farm to fork: Microplastic contamination in the meat and dairy supply chain",
    publication: "Current Research in Food Science (2026)",
  },
  {
    id: 9,
    url: "https://pubmed.ncbi.nlm.nih.gov/41827204/",
    title: "Diabetes Mellitus as an Integrated Microbiome, Immune, and Metabolic Disorder with Clinical Implications for Multisystem Complications and Public Health",
    publication: "Journal of Clinical Medicine (2026)",
  },
  {
    id: 14,
    url: "https://pubmed.ncbi.nlm.nih.gov/41769655/",
    title: "Nutrition and the gut microbiome: a symbiotic dialogue influencing health and disease",
    publication: "Frontiers in Nutrition (2026)",
  },
  {
    id: 18,
    url: "https://pubmed.ncbi.nlm.nih.gov/41160105/",
    title: "Microbiome modulation as a therapeutic strategy for alcohol-induced gut dysbiosis and associated disorders",
    publication: "Antonie van Leeuwenhoek (2025)",
  },
] as const;

function citationAnchor(id: number) {
  return `<a href="#source-${id}" class="um-post-citation" aria-label="View source ${id}">[${id}]</a>`;
}

export function appendPost11154References(content: string): string {
  if (content.includes(POST_11154_REFERENCE_MARKER)) {
    throw new Error("Post 11154 already contains the guarded source marker; refusing duplicate bibliography.");
  }

  let revised = content;
  if (!revised.includes("[4]")) {
    const plasticContainerNeedle = "<li>Replace plastic food containers with glass</li>";
    if (!revised.includes(plasticContainerNeedle)) {
      throw new Error("Expected plastic-container guidance was not found; refusing to invent source-four placement.");
    }
    revised = revised.replace(plasticContainerNeedle, `${plasticContainerNeedle}<span class="um-post-citation-context"> [4]</span>`);
  }
  for (const reference of references) {
    const marker = `[${reference.id}]`;
    if (!revised.includes(marker)) {
      throw new Error(`Expected inline citation ${marker} was not found; refusing incomplete bibliography.`);
    }
    revised = revised.replaceAll(marker, citationAnchor(reference.id));
  }

  const bibliography = `<section ${POST_11154_REFERENCE_MARKER} aria-labelledby="post-11154-sources"><h2 id="post-11154-sources">Sources</h2><p>These sources correspond to the numbered citations in the article and are provided for further reading.</p><ul class="um-post-sources">${references
    .map(
      reference =>
        `<li id="source-${reference.id}"><strong>[${reference.id}]</strong> <a href="${reference.url}" target="_blank" rel="noopener noreferrer">${reference.title}</a>. <em>${reference.publication}</em>.</li>`
    )
    .join("")}</ul></section>`;

  return `${revised}\n${bibliography}`;
}

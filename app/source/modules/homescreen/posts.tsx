
import { d_assets } from "../../configs/assets";
export default [
  // NEWS (with video)
  {
    id: "1",
    category: "news",
    user: {
      name: "@StSiege",
      profileImage: d_assets.images.appLogo,
    },
    images: [d_assets.images.postImg],
    // video: require("../../assets/videos/demo.mp4"), // sample video
    text: "Installation des 15 membres du Conseil Supérieur de Transition de l’Église du Christianisme Céleste : Une étape décisive vers la réunification",
    isLongText: false,
    likes: 120,
    comments: 15,
    shares: 8,
  },
  {
    id: "2",
    category: "news",
    user: {
      name: "@cst",
      profileImage: d_assets.images.appLogo,
    },
    images: [d_assets.images.postImg1],
    // title: "Programme de l'Anniversaire de l'Église publié",
    text: "Le samedi 26 avril 2025, les quinze membres du Conseil Supérieur de Transition de l’Église du Christianisme Céleste ont été officiellement installés au cours d'une cérémonie solennelle à Cotonou, en présence du Président Patrice TALON et de plusieurs membres du Gouvernement. Au nombre de ces personnalités, temoins de ce renouveau de l’Église du Christianisme Céleste, les Ministres Jean-Michel ABIMBOLA, Yvon DETCHENOU, Alassane SEIDOU, le Secrétaire Général de la Présidence Pascal Irénée KOUPAKI, le Porte-parole du Gouvernement Wilfried Léandre HOUNGBÉDJI, le Préfet du Littoral Alain OROUNLA, ainsi que plusieurs autres cadres, autorités religieuses et civiles, dignitaires et fidèles. En effet, créée le 29 septembre 1947 au Bénin, l’Église du Christianisme céleste a, depuis la mort de son fondateur, le Prophète OSHOFFA, été en proie, des dizaines d'années durant, à des incompréhensions, des rivalités et des crises de gouvernance. Elle s'est donc retrouvée avec plusieurs courants et sans autorités consensuelles, laissant les fidèles d'Afrique et du monde dans la confusion et la souffrance. ",
    isLongText: true,
    likes: 250,
    comments: 42,
    shares: 19,
  },

  // ANNOUNCEMENTS (with audio)
  {
    id: "11",
    category: "announcements",
    title:
      "Conseil Supérieur de Transition de l'Eglise du Christianisme Céleste : Des avancées majeures au terme de la première session",
    date: "2025-08-10",
    isLongText: true,
    content:
      "En véritable Père de la Nation béninoise, le Président Patrice TALON a entrepris de participer à la réunification des dirigeants de l’Église du Christianisme Céleste (E.C.C) en proie à des divisions, mettant en souffrance les fidèles du Bénin, du Nigéria et du monde.",
    image: d_assets.images.postImg1,
    audio:
      "http://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3", // sample audio
  },
  {
    id: "12",
    category: "announcements",
    title:
      "Installation des 15 membres du Conseil Supérieur de Transition de l’Église du Christianisme Céleste",
    date: "2025-07-25",
    content:
      "Pour aboutir à cette réunification longtemps attendue, un Conseil Supérieur de Transition de l'ECC a été installé officiellement le 26 avril 2025 au Palais des Congrès de Cotonou en présence du Chef de l’État. Ce Conseil Supérieur de Transition, organe central chargé de conduire le processus de réunification de l'Église sur une période d'un an, a tenu sa première session les 8 et 9 mai 2025, à son siège à Cotonou. ",
    image: d_assets.images.postImg2,
  },
  // REFORMS
  {
    id: "21",
    category: "reforms",
    title: "Troisième session ordinaire du CST",
    summary:
      "Plusieurs documents structurants ont été validés par la CST; Ce Conseil Supérieur de Transition, organe central chargé de conduire le processus de réunification de l'Église sur une période d'un an, a tenu sa troisième session du 23 et 31 juillet 2025, à son siège à Cotonou",
    fullText: `
    <h3 style="color:#0b5394;">🔍 Troisième Session Ordinaire du CST</h3>
    <p>Le <strong>Conseil Supérieur de Transition (CST)</strong> a tenu sa troisième session du <em>23 au 31 juillet 2025</em> à Cotonou.</p>
    <p>Plusieurs documents structurants ont été examinés et validés au cours de cette session cruciale, marquant une avancée significative dans le processus de réunification de l’Église du Christianisme Céleste.</p>
    <p style="color:#666;">Christ est notre Chef.</p>
  `,
    updatedBy: "Admin",
    updatedOn: "2025-07-20",
  },
  {
    id: "22",
    category: "reforms",
    title: "Première session ordinaire du CST",
    summary:
      "Ce Conseil Supérieur de Transition, organe central chargé de conduire le processus de réunification de l'Église sur une période d'un an, a tenu sa première session les 8 et 9 mai 2025, à son siège à Cotonou",
    fullText: `
    <h3 style="color:#0b5394;">🗓 Première Session du CST – 8 et 9 Mai 2025</h3>
    <ul>
      <li><strong>Mise en place du Secrétariat Exécutif :</strong> composé de sept membres pour coordonner les opérations du CST.</li>
      <li><strong>Réorganisation des Commissions Thématiques :</strong> trois commissions ont été retenues :
        <ul>
          <li>📘 Relecture de la Constitution et hiérarchie ecclésiale</li>
          <li>📜 Revue des textes fondamentaux, rites, liturgie et organisation des pèlerinages</li>
          <li>💼 Réforme de la gestion administrative et financière</li>
        </ul>
      </li>
      <li><strong>Adoption de la feuille de route :</strong> un plan de travail a été mis en place pour atteindre les objectifs définis.</li>
    </ul>
    <p style="color:#666;">Christ est notre Chef.</p>
  `,
    updatedBy: "Admin",
    updatedOn: "2025-07-20",
  },

  // DECISIONS
  {
    id: "31",
    category: "decisions",
    decisionTitle: "Décisions lors de la première session ordinaire du CST",
    decisionDate: "2025-07-01",
    decisionSummary:
      "Des actes concrets sont en train d'être posés pour un aboutissement heureux de la réunification de l’Église du Christianisme Céleste.",
    decisionDetails: `
    <h3 style="color:#0b5394;">📋 Décisions Clés – Première Session du CST</h3>
    <ul>
      <li><strong>Mise en place du Secrétariat Exécutif :</strong> chargé de la coordination opérationnelle (7 membres).</li>
      <li><strong>Réorganisation des Commissions Thématiques :</strong>
        <ul>
          <li>📘 Relecture de la Constitution & hiérarchie ecclésiale</li>
          <li>📜 Rites, liturgie, organisation des pèlerinages</li>
          <li>💼 Gestion administrative et financière</li>
        </ul>
      </li>
      <li><strong>Feuille de route adoptée :</strong> le plan guide les travaux jusqu’à la réunification.</li>
    </ul>
    <p style="color:#666;">Christ est notre Chef.</p>
  `,
  },

  // EVENTS
  {
    id: "41",
    category: "events",
    eventName: "Pélérinage Sèmè 2025: sera diffusé sur l'application Cèlè One",
    eventDate: "2025-12-24",
    eventLocation: "Site Sèmè Kpodji",
    description: `
    <h3 style="color:#0b5394;">📣 Annonce Officielle – Pèlerinage de Sèmè 2025</h3>
    <p>Le <strong>pèlerinage annuel de Sèmè</strong> se tiendra cette année à partir du <em>24 décembre 2025</em> à <strong>Sèmè-Kpodji</strong>.</p>
    <p>🎥 <strong>Suivez la diffusion en direct</strong> exclusivement sur <span style="color:#007ACC;">l'application Cele One</span>.</p>
    <p>Téléchargez l'app dès maintenant et participez où que vous soyez !</p>
    <p style="color:#666;">Christ est notre Chef.</p>
  `,
    bannerImage: d_assets.images.postImg2,
  },
];

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBC3MTssV5lPRkkuf2Sct_UtGjWX1PfYzk",
  authDomain: "celeone-e5843.firebaseapp.com",
  projectId: "celeone-e5843",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🚀 Import function
async function importCantiques() {
  const rawText = document.getElementById("rawText").value;
  const language = document.getElementById("language").value || "goun";
  const status = document.getElementById("status");

  if (!rawText.trim()) {
    status.textContent = "Aucun texte fourni.";
    return;
  }

  // Split by hymn number
  const blocks = rawText.split(/\n(?=\d+\.)/);

  let count = 0;

  for (const block of blocks) {
    const match = block.match(/^(\d+)\.\s*([\s\S]*)/);
    if (!match) continue;

    const hymnNumber = match[1];
    const hymnContent = match[2].trim();

    await addDoc(collection(db, "cantiques"), {
      language,
      title: "",
      hymnNumber,
      hymnContent,
      musicalKey: "",
      createdAt: serverTimestamp(),
    });

    count++;
  }

  status.textContent = `${count} cantiques importés avec succès ✔`;
}

window.importCantiques = importCantiques;

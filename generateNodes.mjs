// generateNodes.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf-8'));

// ---- PARAMÈTRES ----
const NODE_COUNT = 100;
const MAP_SIZE = 100;
const MIN_DISTANCE = 7; // Distance minimale entre nodes

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
const db = getFirestore();

function getRandomPosition(existing, minDist, maxSize) {
  let tries = 0;
  while (tries < 5000) {
    const x = Math.floor(Math.random() * maxSize);
    const y = Math.floor(Math.random() * maxSize);
    const valid = existing.every(pos => {
      const dx = pos.x - x;
      const dy = pos.y - y;
      return Math.sqrt(dx * dx + dy * dy) >= minDist;
    });
    if (valid) return { x, y };
    tries++;
  }
  throw new Error("Impossible de placer tous les nodes avec la distance demandée !");
}

async function generateNodes(count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const pos = getRandomPosition(positions, MIN_DISTANCE, MAP_SIZE);
    positions.push(pos);

    await db.collection('nodes').add({
      owner: null,
      name: `Zone ${i + 1}`,
      pos,
      createdAt: null,
      defense: 10,
      capacity: 100,
      isUnderAttack: false,
      mines: {
        data: { level: 1, production: 10, upgradeEnd: null },
        cpu: { level: 1, production: 2, upgradeEnd: null },
        bandwidth: { level: 1, production: 1, upgradeEnd: null }
      },
      resources: { data: 0, cpu: 0, bandwidth: 0 },
      army: {
        units: {
          dronePillard: 0,
          gardienNumerique: 0,
          agentEspion: 0,
          hackerVR: 0,
          titanDigital: 0,
          chasseurNumerique: 0,
          bombardierVirtuel: 0,
          transporteurVR: 0,
          fregateNumerique: 0,
          croiseurDigital: 0,
          cuirasseVirtuel: 0
        },
        queue: []
      }
    });
    console.log(`Node #${i + 1} créé en ${pos.x},${pos.y}`);
  }
  console.log("Nodes générés !");
}

generateNodes(NODE_COUNT);

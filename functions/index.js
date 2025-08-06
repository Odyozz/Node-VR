const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ maxInstances: 5 });

// PARAMÈTRES
const MAP_SIZE = 100;
const MAX_TRIES = 1000;

// === Utilise la région europe-west1 ===
const REGION = "europe-west1";

async function getRandomMinePosition() {
  // Récupère les positions des nodes existants
  const nodesSnap = await db.collection("nodes").get();
  const nodePositions = nodesSnap.docs.map(doc => {
    const pos = doc.data().pos;
    return `${pos.x},${pos.y}`;
  });

  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const x = Math.floor(Math.random() * MAP_SIZE);
    const y = Math.floor(Math.random() * MAP_SIZE);
    const key = `${x},${y}`;
    if (!nodePositions.includes(key)) {
      return { x, y };
    }
  }
  throw new Error("Impossible de placer une mine hors des nodes !");
}

// SPAWN MINE (Europe)
exports.spawnMine = onSchedule(
  { schedule: "every 30 minutes", region: REGION },
  async (event) => {
    // 1. Génère une position valide
    const pos = await getRandomMinePosition();

    // 2. Type de ressource
    const types = ["data", "cpu", "bandwidth"];
    const type = types[Math.floor(Math.random() * types.length)];

    // 3. Durée de vie (6h)
    const lifetimeMs = 6 * 60 * 60 * 1000;

    await db.collection("mines").add({
      pos,
      type,
      spawnedAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + lifetimeMs)),
      capturedBy: null
    });

    logger.info(`Mine "${type}" spawn en (${pos.x},${pos.y})`);
    return null;
  }
);

// DESPAWN (CLEANUP) MINES (Europe)
exports.cleanupMines = onSchedule(
  { schedule: "every 1 hours", region: REGION },
  async (event) => {
    const now = admin.firestore.Timestamp.now();
    const mines = await db.collection("mines").where("expiresAt", "<=", now).get();

    if (mines.empty) {
      logger.info("Aucune mine à nettoyer.");
      return null;
    }

    const batch = db.batch();
    mines.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Nettoyé ${mines.size} mines expirées`);
    return null;
  }
);

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

// === [AJOUT] : Gestion automatique de l'arrivée des armées et captures/combat ===

exports.processArmyArrivals = onSchedule(
  { schedule: "every 1 minutes", region: REGION },
  async (event) => {
    const now = Date.now();
    const ordersSnap = await db.collection('armyOrders')
      .where('status', '==', 'enCours')
      .where('arrivesAt', '<=', now)
      .get();

    if (ordersSnap.empty) return null;

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();

      // Détermine si la cible est un node (libre ou non)
      let targetRef, targetSnap, targetData, isNodeLibre = false;
      if (order.toType === 'node') {
        targetRef = db.collection('nodes').doc(order.toId);
        targetSnap = await targetRef.get();
        targetData = targetSnap.exists ? targetSnap.data() : null;
        isNodeLibre = !!targetData && !targetData.owner;
      } else if (order.toType === 'mine') {
        targetRef = db.collection('mines').doc(order.toId);
        targetSnap = await targetRef.get();
        targetData = targetSnap.exists ? targetSnap.data() : null;
      } else {
        // Type inconnu
        await orderDoc.ref.update({ status: "fail", info: "Cible inconnue" });
        continue;
      }

      // === Node libre ===
      if (isNodeLibre) {
        // a. Déjà une armée en train de capturer ?
        if (targetData.capturingArmy && targetData.capturingArmy.playerId !== order.playerId) {
          // Combat pour contestation de node
          await handleNodeCaptureContest(orderDoc, order, targetRef, targetData);
          continue;
        }
        // b. Pas de contestation, débute la capture
        await handleNodeCaptureStart(orderDoc, order, targetRef, targetData);
      } else {
        // Combat classique node occupé/mine
        await handleClassicAttack(orderDoc, order, targetRef, targetData);
      }
    }
    return null;
  }
);

// === Logique de capture sur node libre ===
async function handleNodeCaptureStart(orderDoc, order, nodeRef, nodeData) {
  // Vérifie si déjà une armée sur le node (fail-safe)
  if (nodeData.capturingArmy) return; // déjà capturé/capture en cours

  // Débute la capture : armée posée, timer lancé
  const captureTimeMs = 3 * 60 * 1000; // 3 minutes par défaut (à ajuster)
  await nodeRef.update({
    capturingArmy: {
      playerId: order.playerId,
      fromNodeId: order.fromNodeId,
      units: order.units,
      startedAt: Date.now(),
      captureEndAt: Date.now() + captureTimeMs,
      orderId: orderDoc.id
    }
  });
  await orderDoc.ref.update({
    status: "captureEnCours",
    info: "Début de capture, en attente…"
  });
}

// === Contestation de capture sur node libre ===
async function handleNodeCaptureContest(orderDoc, order, nodeRef, nodeData) {
  const attackerUnits = order.units;
  const defenderUnits = nodeData.capturingArmy.units;

  // Simule le combat
  const result = simulateBattle(attackerUnits, defenderUnits);

  if (result.winner === "attacker") {
    // Attaquant prend la place : timer reset
    const captureTimeMs = 3 * 60 * 1000;
    await nodeRef.update({
      capturingArmy: {
        playerId: order.playerId,
        fromNodeId: order.fromNodeId,
        units: result.attackerRemaining,
        startedAt: Date.now(),
        captureEndAt: Date.now() + captureTimeMs,
        orderId: orderDoc.id
      }
    });
    await orderDoc.ref.update({ status: "captureEnCours", info: "A remporté la contestation et débute la capture." });
    // L’armée défender perdante doit être gérée (rapatriement si tu veux, ou supprimée)
  } else {
    // Attaquant perd, retourne chez lui
    await orderDoc.ref.update({ status: "retourEchec", info: "A perdu la contestation de node." });
  }
}

// === Combat classique node/mine ===
async function handleClassicAttack(orderDoc, order, targetRef, targetData) {
  if (!targetData) {
    await orderDoc.ref.update({ status: "fail", info: "Cible introuvable" });
    return;
  }
  // Si node ennemi (owner != attaquant)
  if (targetData.owner && targetData.owner !== order.playerId) {
    const defenderUnits = targetData.army?.units || {};
    const result = simulateBattle(order.units, defenderUnits);

    if (result.winner === "attacker") {
      // Prend possession du node
      await targetRef.update({
        owner: order.playerId,
        army: { units: result.attackerRemaining }
      });
      await orderDoc.ref.update({ status: "victoire", info: "Node capturé !" });
    } else {
      // Défenseur garde le node
      await targetRef.update({
        army: { units: result.defenderRemaining }
      });
      await orderDoc.ref.update({ status: "defaite", info: "Défaite sur le node." });
    }
  } else {
    // Cas mine ou node à soi, à raffiner selon besoins
    await orderDoc.ref.update({ status: "fail", info: "Cible invalide ou non combattable." });
  }
}

// === Simulateur de combat évolutif ===
function simulateBattle(attackerUnits, defenderUnits) {
  // Priorité : petites unités meurent d'abord
  const unitOrder = [
    "agentEspion", "dronePillard", "hackerVR", "chasseurNumerique",
    "fregateNumerique", "bombardierVirtuel", "croiseurDigital",
    "gardienNumerique", "cuirasseVirtuel", "titanDigital", "transporteurVR"
  ];

  // Force brute (exemple), à raffiner avec stats d’attaque/défense si tu veux
  let attackerPower = 0, defenderPower = 0;
  for (const key of unitOrder) {
    attackerPower += (attackerUnits[key] || 0);
    defenderPower += (defenderUnits[key] || 0);
  }

  if (attackerPower > defenderPower) {
    return {
      winner: "attacker",
      attackerRemaining: attackerUnits,
      defenderRemaining: {}
    };
  } else {
    return {
      winner: "defender",
      attackerRemaining: {},
      defenderRemaining: defenderUnits
    };
  }
}

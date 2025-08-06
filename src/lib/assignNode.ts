import { db } from './firebase';
import { collection, query, where, getDocs, updateDoc, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import type { User } from "firebase/auth";
import type { ArmyUnitKey } from '$lib/types';

const INITIAL_RESOURCES = {
  data: 5000,
  cpu: 1000,
  bandwidth: 1500,
  createdAt: new Date(),
};

// Définis tous tes ArmyUnitKey ici (même ordre/noms que dans types.ts)
const ARMY_UNIT_KEYS: ArmyUnitKey[] = [
  'dronePillard',
  'gardienNumerique',
  'agentEspion',
  'hackerVR',
  'titanDigital',
  'chasseurNumerique',
  'bombardierVirtuel',
  'transporteurVR',
  'fregateNumerique',
  'croiseurDigital',
  'cuirasseVirtuel',
];

export async function assignRandomNodeToUser(user: User) {
  // Assigner un node libre
  const q = query(
    collection(db, "nodes"),
    where("owner", "==", null),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const nodeDoc = snap.docs[0];

    // --- Initialisation de l'armée à 0 pour chaque unité ---
    const initialArmyUnits: Record<ArmyUnitKey, number> = {};
    for (const key of ARMY_UNIT_KEYS) {
      initialArmyUnits[key] = 0;
    }

    await updateDoc(nodeDoc.ref, {
      owner: user.uid,
      createdAt: new Date(),
      resources: {
        data: INITIAL_RESOURCES.data,
        cpu: INITIAL_RESOURCES.cpu,
        bandwidth: INITIAL_RESOURCES.bandwidth,
      },
      army: {
        units: initialArmyUnits,
        queue: [],
      }
    });

    // Créer le doc player si inexistant, avec capital initial
    const playerRef = doc(db, 'players', user.uid);
    const playerSnap = await getDoc(playerRef);
    if (!playerSnap.exists()) {
      await setDoc(playerRef, INITIAL_RESOURCES);
    }

    return { id: nodeDoc.id, ...nodeDoc.data() };
  } else {
    throw new Error("Aucun node libre à assigner ! (admin doit en générer)");
  }
}

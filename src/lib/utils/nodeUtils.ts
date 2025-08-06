// src/lib/utils/nodeUtils.ts

import { getNodeBonuses } from './bonusUtils';

export type NodeData = {
  id: string;
  resources: { data: number; cpu: number; bandwidth: number };
  storage?: {
    dataStorage?: { level: number };
    cpuStorage?: { level: number };
    bandwidthStorage?: { level: number };
  };
  mines?: {
    data?: { level: number };
    cpu?: { level: number };
    bandwidth?: { level: number };
  };
  constructions?: { [key: string]: number }; // Pour les autres bâtiments/bonus
  upgrades?: Record<string, number>;
};

// --- BASES ---
const BASE_PROD = {
  mineData: 5,
  mineCPU: 2,
  mineBandwidth: 1,
};

const STORAGE_PER_LVL = {
  dataStorage: 1000,
  cpuStorage: 500,
  bandwidthStorage: 300,
};

// --- GET LEVEL (unifié pour tout) ---
export function getBuildingLevel(node: NodeData, buildingId: string): number {
  if (!node) return 0;
  if (buildingId === 'dataStorage') return node.storage?.dataStorage?.level ?? 0;
  if (buildingId === 'cpuStorage') return node.storage?.cpuStorage?.level ?? 0;
  if (buildingId === 'bandwidthStorage') return node.storage?.bandwidthStorage?.level ?? 0;
  if (buildingId === 'mineData') return node.mines?.data?.level ?? 0;
  if (buildingId === 'mineCPU') return node.mines?.cpu?.level ?? 0;
  if (buildingId === 'mineBandwidth') return node.mines?.bandwidth?.level ?? 0;
  return node.constructions?.[buildingId] ?? 0;
}

// --- GET STORAGE MAX ---
export function getStorageMax(node: NodeData) {
  return {
    data: 1000 + (getBuildingLevel(node, 'dataStorage') * STORAGE_PER_LVL.dataStorage),
    cpu: 500 + (getBuildingLevel(node, 'cpuStorage') * STORAGE_PER_LVL.cpuStorage),
    bandwidth: 300 + (getBuildingLevel(node, 'bandwidthStorage') * STORAGE_PER_LVL.bandwidthStorage),
  };
}

export function getMineProduction(node: NodeData, buildingId: string): number {
  const level = getBuildingLevel(node, buildingId);
  if (level === 0) return 0;
  const base = BASE_PROD[buildingId as keyof typeof BASE_PROD] || 0;

  // Applique tous les bonus via bonusUtils
  const bonuses = getNodeBonuses(node);

  // Bonus par niveau (scaling exponentiel)
  const baseMultiplier = Math.pow(1.1, Math.max(0, level - 1));

  // Bonus global de prod de mines
  const totalMultiplier = baseMultiplier * bonuses.mineProductionMultiplier;

  // Production finale
  return Math.round(base * level * totalMultiplier);
}


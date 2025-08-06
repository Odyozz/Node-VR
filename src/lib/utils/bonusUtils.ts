// src/lib/utils/bonusUtils.ts

import type { NodeData } from './nodeUtils';

// Calcule tous les bonus actifs sur le node (ex : bonus de défense, prod, stockage…)
export function getNodeBonuses(node: NodeData) {
  const bonuses = {
    // Ressources
    mineProductionMultiplier: 1, // Multiplicateur global mines (hors level)
    // Défense
    passiveDefenseBonus: 0,      // Pourcent défense passive
    // Stockage
    dataStorageBonus: 0,         // % bonus stockage
    cpuStorageBonus: 0,
    bandwidthStorageBonus: 0,
    // ...autres bonus à venir
  };

  // BONUS MINE OPTIMIZATION (prod mines +10%/lvl)
  const mineOptLevel = node.constructions?.mineOptimization ?? 0;
  if (mineOptLevel > 0) {
    bonuses.mineProductionMultiplier += 0.10 * mineOptLevel;
  }

  // BONUS DEFENSE OPTIMIZATION (défense passive +10%/lvl)
  const defOptLevel = node.constructions?.defenseOptimization ?? 0;
  if (defOptLevel > 0) {
    bonuses.passiveDefenseBonus += 0.10 * defOptLevel;
  }

  // BONUS HANGARS (ex : si tu veux plus tard ajouter des bonus % de stockage max)
  // const dataHangarBonusLevel = node.constructions?.dataStorageBonus ?? 0;
  // if (dataHangarBonusLevel > 0) {
  //   bonuses.dataStorageBonus += 0.10 * dataHangarBonusLevel;
  // }

  // BONUS FUTURS ICI

  return bonuses;
}

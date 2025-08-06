import type { ArmyUnitDefinition } from '../types';
import { armyUnits } from './units';
import type { NodeData } from './nodeUtils';
import { getNodeBonuses } from './bonusUtils';

// Retourne la définition d'une unité
export function getArmyUnitByKey(key: string): ArmyUnitDefinition | undefined {
  return armyUnits.find(u => u.key === key);
}

// Liste les unités déverrouillées pour ce node (prérequis constructions/techs)
export function getAvailableArmyUnitsForNode(node: NodeData): ArmyUnitDefinition[] {
  return armyUnits.filter(unit => {
    if (unit.prereqs.construction) {
      for (const [c, lvl] of Object.entries(unit.prereqs.construction)) {
        if ((node.constructions?.[c] ?? 0) < lvl) return false;
      }
    }
    if (unit.prereqs.tech) {
      for (const [t, lvl] of Object.entries(unit.prereqs.tech)) {
        if ((node.techs?.[t] ?? 0) < lvl) return false;
      }
    }
    return true;
  });
}

// Calcule coût (bonus à appliquer ici plus tard)
export function getArmyUnitCostWithBonus(node: NodeData, unit: ArmyUnitDefinition) {
  // Bonus éventuels à appliquer ici
  return { ...unit.baseCost };
}

// Calcule temps de prod (bonus à appliquer ici)
export function getArmyUnitTimeWithBonus(node: NodeData, unit: ArmyUnitDefinition) {
  let time = unit.baseTime;
  const factoryLvl = node.constructions?.factory ?? 0;
  if (factoryLvl > 0) {
    time *= Math.pow(0.90, factoryLvl); // -10%/niveau
  }
  // Applique aussi ici tout bonus global via bonusUtils
  // ex: time *= getNodeBonuses(node).unitProductionMultiplier ?? 1;
  return Math.floor(time);
}

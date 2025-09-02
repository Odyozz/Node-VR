import type { ArmyUnitKey } from '$lib/types';
import { armyUnits } from './units';

export interface CombatResult {
  winner: 'attacker' | 'defender';
  attackerRemaining: Record<string, number>;
  defenderRemaining: Record<string, number>;
  battleLog: string[];
  casualties: {
    attacker: Record<string, number>;
    defender: Record<string, number>;
  };
}

export interface UnitStats {
  attack: number;
  defense: number;
  health: number;
  speed: number;
}

// Statistiques détaillées par unité
const unitStats: Record<ArmyUnitKey, UnitStats> = {
  dronePillard: { attack: 5, defense: 2, health: 8, speed: 10 },
  gardienNumerique: { attack: 4, defense: 10, health: 15, speed: 4 },
  agentEspion: { attack: 1, defense: 1, health: 3, speed: 12 },
  hackerVR: { attack: 0, defense: 3, health: 5, speed: 8 },
  titanDigital: { attack: 40, defense: 25, health: 80, speed: 3 },
  chasseurNumerique: { attack: 8, defense: 5, health: 12, speed: 11 },
  bombardierVirtuel: { attack: 25, defense: 8, health: 20, speed: 5 },
  transporteurVR: { attack: 2, defense: 6, health: 18, speed: 6 },
  fregateNumerique: { attack: 18, defense: 12, health: 30, speed: 6 },
  croiseurDigital: { attack: 55, defense: 35, health: 100, speed: 4 },
  cuirasseVirtuel: { attack: 120, defense: 75, health: 200, speed: 2 }
};

// Ordre de priorité des cibles (les plus faibles en premier)
const targetPriority: ArmyUnitKey[] = [
  'agentEspion',
  'hackerVR', 
  'dronePillard',
  'chasseurNumerique',
  'gardienNumerique',
  'bombardierVirtuel',
  'transporteurVR',
  'fregateNumerique',
  'titanDigital',
  'croiseurDigital',
  'cuirasseVirtuel'
];

export function simulateDetailedBattle(
  attackerUnits: Record<string, number>,
  defenderUnits: Record<string, number>,
  defenseBonus = 0
): CombatResult {
  const battleLog: string[] = [];
  const casualties = {
    attacker: {} as Record<string, number>,
    defender: {} as Record<string, number>
  };

  // Copie des unités avec points de vie
  const attackerFleet = createFleetWithHealth(attackerUnits);
  const defenderFleet = createFleetWithHealth(defenderUnits);

  battleLog.push(`🚀 Début du combat !`);
  battleLog.push(`Attaquant: ${formatFleet(attackerUnits)}`);
  battleLog.push(`Défenseur: ${formatFleet(defenderUnits)} (+${defenseBonus}% défense)`);

  let round = 1;
  const maxRounds = 20;

  while (round <= maxRounds && hasUnits(attackerFleet) && hasUnits(defenderFleet)) {
    battleLog.push(`\n--- Round ${round} ---`);

    // Phase d'attaque
    executeAttackPhase(attackerFleet, defenderFleet, 'attacker', defenseBonus, battleLog);
    if (!hasUnits(defenderFleet)) break;

    executeAttackPhase(defenderFleet, attackerFleet, 'defender', 0, battleLog);
    if (!hasUnits(attackerFleet)) break;

    round++;
  }

  // Calcul des survivants et pertes
  const attackerRemaining = fleetToUnits(attackerFleet);
  const defenderRemaining = fleetToUnits(defenderFleet);

  for (const unitKey of Object.keys(attackerUnits)) {
    casualties.attacker[unitKey] = attackerUnits[unitKey] - (attackerRemaining[unitKey] || 0);
  }
  for (const unitKey of Object.keys(defenderUnits)) {
    casualties.defender[unitKey] = defenderUnits[unitKey] - (defenderRemaining[unitKey] || 0);
  }

  const winner = hasUnits(attackerFleet) ? 'attacker' : 'defender';
  battleLog.push(`\n🏆 Victoire: ${winner === 'attacker' ? 'Attaquant' : 'Défenseur'}`);

  return {
    winner,
    attackerRemaining,
    defenderRemaining,
    battleLog,
    casualties
  };
}

function createFleetWithHealth(units: Record<string, number>) {
  const fleet: Record<string, { count: number; health: number[] }> = {};
  
  for (const [unitKey, count] of Object.entries(units)) {
    if (count > 0) {
      const stats = unitStats[unitKey as ArmyUnitKey];
      if (stats) {
        fleet[unitKey] = {
          count,
          health: Array(count).fill(stats.health)
        };
      }
    }
  }
  
  return fleet;
}

function hasUnits(fleet: Record<string, { count: number; health: number[] }>): boolean {
  return Object.values(fleet).some(unit => unit.count > 0);
}

function executeAttackPhase(
  attackerFleet: Record<string, { count: number; health: number[] }>,
  defenderFleet: Record<string, { count: number; health: number[] }>,
  side: string,
  defenseBonus: number,
  battleLog: string[]
) {
  for (const [attackerUnit, attackerData] of Object.entries(attackerFleet)) {
    if (attackerData.count === 0) continue;

    const attackerStats = unitStats[attackerUnit as ArmyUnitKey];
    if (!attackerStats || attackerStats.attack === 0) continue;

    // Trouve la cible prioritaire
    const target = findTarget(defenderFleet);
    if (!target) break;

    const [targetUnit, targetData] = target;
    const targetStats = unitStats[targetUnit as ArmyUnitKey];
    
    // Calcul des dégâts
    const baseAttack = attackerStats.attack * attackerData.count;
    const defense = targetStats.defense * (1 + defenseBonus / 100);
    const damage = Math.max(1, Math.floor(baseAttack - defense));

    // Application des dégâts
    let remainingDamage = damage;
    let killed = 0;

    for (let i = 0; i < targetData.health.length && remainingDamage > 0; i++) {
      if (targetData.health[i] <= 0) continue;
      
      const damageToUnit = Math.min(remainingDamage, targetData.health[i]);
      targetData.health[i] -= damageToUnit;
      remainingDamage -= damageToUnit;

      if (targetData.health[i] <= 0) {
        killed++;
      }
    }

    // Mise à jour du count
    targetData.count = targetData.health.filter(h => h > 0).length;
    targetData.health = targetData.health.filter(h => h > 0);

    if (killed > 0) {
      battleLog.push(`${getUnitName(attackerUnit)} (${attackerData.count}) → ${getUnitName(targetUnit)} : ${killed} détruits`);
    }
  }
}

function findTarget(fleet: Record<string, { count: number; health: number[] }>) {
  for (const unitKey of targetPriority) {
    if (fleet[unitKey] && fleet[unitKey].count > 0) {
      return [unitKey, fleet[unitKey]] as const;
    }
  }
  return null;
}

function fleetToUnits(fleet: Record<string, { count: number; health: number[] }>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [unitKey, data] of Object.entries(fleet)) {
    result[unitKey] = data.count;
  }
  return result;
}

function formatFleet(units: Record<string, number>): string {
  return Object.entries(units)
    .filter(([_, count]) => count > 0)
    .map(([unit, count]) => `${getUnitName(unit)} x${count}`)
    .join(', ') || 'Aucune unité';
}

function getUnitName(unitKey: string): string {
  const unit = armyUnits.find(u => u.key === unitKey);
  return unit?.name || unitKey;
}
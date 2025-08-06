export type ConstructionKey =
  | 'mineData'
  | 'mineCPU'
  | 'mineBandwidth'
  | 'shield'
  | 'activeDefense'
  | 'firewall'
  | 'commandCenter'
  | 'researchLab'
  | 'factory'
  | 'mineOptimization'
  | 'defenseOptimization'
  | 'transportNetwork'
  | 'cryptographyCenter'
  | 'advancedServers'
  | 'surveillanceStation';

export interface ConstructionDefinition {
  key: ConstructionKey;
  name: string;
  description: string;
  prereqs: {
    construction?: Partial<Record<ConstructionKey, number>>; // constructions + niveau
    tech?: Partial<Record<string, number>>; // techs + niveau (string techKey)
  };
  baseCost: { data: number; cpu: number; bandwidth: number };
  baseTime: number; // en secondes
  production?: { data?: number; cpu?: number; bandwidth?: number };
  defenseBonus?: number;
  capacityBonus?: number;
}



export const constructions: ConstructionDefinition[] = [
  {
    key: 'mineData',
    name: 'Mine de Données',
    description: 'Produit des données, la ressource principale du système.',
    prereqs: {},
    baseCost: { data: 100, cpu: 0, bandwidth: 0 },
    baseTime: 30,
    production: { data: 10 },
  },
  {
    key: 'mineCPU',
    name: 'Mine de Cycles CPU',
    description: 'Produit des cycles CPU, ressource avancée pour unités puissantes.',
    prereqs: { construction: { mineData: 3 } },
    baseCost: { data: 400, cpu: 0, bandwidth: 0 },
    baseTime: 120,
    production: { cpu: 1 },
  },
  {
    key: 'mineBandwidth',
    name: 'Mine de Bande Passante',
    description: 'Produit de la bande passante, pour accélérer déplacements et constructions.',
    prereqs: { construction: { mineCPU: 3 } },
    baseCost: { data: 300, cpu: 100, bandwidth: 0 },
    baseTime: 90,
    production: { bandwidth: 2 },
  },
  {
    key: 'shield',
    name: 'Bouclier Numérique',
    description: 'Renforce la défense passive du node.',
    prereqs: { construction: { mineData: 2 } },
    baseCost: { data: 200, cpu: 50, bandwidth: 0 },
    baseTime: 60,
    defenseBonus: 10,
  },
  {
    key: 'activeDefense',
    name: 'Système de Défense Actif',
    description: 'Unités défensives automatiques pour protéger le node.',
    prereqs: { construction: { shield: 3 }, tech: { defenseTech: 1 } },
    baseCost: { data: 500, cpu: 300, bandwidth: 0 },
    baseTime: 300,
  },
  {
    key: 'firewall',
    name: 'Murs Firewall',
    description: 'Augmente la capacité et réduit les dégâts des attaques.',
    prereqs: { tech: { firewallTech: 2 } },
    baseCost: { data: 400, cpu: 400, bandwidth: 100 },
    baseTime: 240,
    capacityBonus: 50,
  },
  {
    key: 'commandCenter',
    name: 'Centre de Commande',
    description: 'Augmente la capacité de gestion du node.',
    prereqs: {},
    baseCost: { data: 300, cpu: 0, bandwidth: 0 },
    baseTime: 90,
    capacityBonus: 100,
  },
  {
    key: 'researchLab',
    name: 'Laboratoire de Recherche',
    description: 'Permet de débloquer des technologies.',
    prereqs: { construction: { mineData: 4 } },
    baseCost: { data: 600, cpu: 200, bandwidth: 100 },
    baseTime: 180,
  },
  {
    key: 'factory',
    name: 'Usine de Construction',
    description: 'Accélère la production des unités.',
    prereqs: { construction: { commandCenter: 2 } },
    baseCost: { data: 500, cpu: 300, bandwidth: 200 },
    baseTime: 150,
  },
  {
    key: 'mineOptimization',
    name: 'Système d’Optimisation des Mines',
    description: 'Boost la production des mines de 10% par niveau.',
    prereqs: { construction: { researchLab: 3 } },
    baseCost: { data: 400, cpu: 400, bandwidth: 100 },
    baseTime: 180,
  },
  {
    key: 'defenseOptimization',
    name: 'Optimisation de Défense',
    description: 'Augmente la défense passive de 10% par niveau.',
    prereqs: { construction: { activeDefense: 2 } },
    baseCost: { data: 500, cpu: 500, bandwidth: 100 },
    baseTime: 180,
  },
  {
    key: 'transportNetwork',
    name: 'Réseau de Transport',
    description: 'Réduit le temps de déplacement des unités.',
    prereqs: { construction: { mineBandwidth: 4 } },
    baseCost: { data: 700, cpu: 600, bandwidth: 400 },
    baseTime: 300,
  },
  {
    key: 'cryptographyCenter',
    name: 'Centre de Cryptographie',
    description: 'Améliore la furtivité des attaques.',
    prereqs: { construction: { researchLab: 5 } },
    baseCost: { data: 1000, cpu: 800, bandwidth: 300 },
    baseTime: 360,
  },
  {
    key: 'advancedServers',
    name: 'Serveurs de Calcul Avancés',
    description: 'Boost CPU et calcul pour flottes avancées.',
    prereqs: { construction: { researchLab: 8 } },
    baseCost: { data: 1500, cpu: 1200, bandwidth: 600 },
    baseTime: 600,
  },
  {
    key: 'surveillanceStation',
    name: 'Station de Surveillance',
    description: 'Permet d’espionner les nodes ennemis.',
    prereqs: { construction: { commandCenter: 3 }, tech: { espionnageTech: 1 } },
    baseCost: { data: 800, cpu: 600, bandwidth: 200 },
    baseTime: 300,
  },
];

// Export fonctions utilitaires pour calcul coût/temps
export function costAtLevel(base: number, level: number): number {
  return Math.floor(base * Math.pow(1.7, level - 1));
}
export function timeAtLevel(base: number, level: number): number {
  return Math.floor(base * Math.pow(1.7, level - 1));
}

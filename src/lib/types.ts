// --- Types généraux ressources ---
export type Resources = {
  data: number;
  cpu: number;
  bandwidth: number;
};

// --- Constructions ---
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
    construction?: Partial<Record<ConstructionKey, number>>;
    tech?: Partial<Record<string, number>>;
  };
  baseCost: { data: number; cpu: number; bandwidth: number };
  baseTime: number; // en secondes
  production?: { data?: number; cpu?: number; bandwidth?: number };
  defenseBonus?: number;
  capacityBonus?: number;
}

// --- NodeData principal ---
export type NodeData = {
  id: string;
  resources: Resources;
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
  constructions?: { [key: string]: number };
  upgrades?: Record<string, number>;
  techs?: Record<string, number>;
  army?: {
    units: Partial<Record<ArmyUnitKey, number>>;
    queue: ArmyQueueItem[];
  };
};

// --- Unités d'armée ---
export type ArmyUnitKey =
  | 'dronePillard'
  | 'gardienNumerique'
  | 'agentEspion'
  | 'hackerVR'
  | 'titanDigital'
  | 'chasseurNumerique'
  | 'bombardierVirtuel'
  | 'transporteurVR'
  | 'fregateNumerique'
  | 'croiseurDigital'
  | 'cuirasseVirtuel';

export interface ArmyUnitDefinition {
  key: ArmyUnitKey;
  name: string;
  description: string;
  prereqs: {
    construction?: Partial<Record<ConstructionKey, number>>;
    tech?: Partial<Record<string, number>>;
  };
  baseCost: { data: number; cpu: number; bandwidth: number };
  baseTime: number; // secondes
  attack?: number;
  defense?: number;
  speed?: number;
  capacity?: number;
  effect?: string;   // ex : 'espionnage', 'bonusVSFrigate', etc.
}

// --- Armée en cours de production ---
export type ArmyQueueItem = {
  key: ArmyUnitKey;
  qty: number;
  endsAt: number; // timestamp de fin de prod (ms)
};

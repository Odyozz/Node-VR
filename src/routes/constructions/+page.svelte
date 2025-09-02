<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth, db } from '$lib/firebase';
  import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
  import type { User } from 'firebase/auth';
  import { resources } from '$lib/stores/resources';
  import { maxResources } from '$lib/stores/maxResources';
  import { get, writable } from 'svelte/store';

  import {
    getBuildingLevel,
    getMineProduction,
    getStorageMax,
    type NodeData
  } from '$lib/utils/nodeUtils';

  import { getNodeBonuses } from '$lib/utils/bonusUtils';
  import { getConstructionImage } from '$lib/utils/imageAssets';
  import { addNotification } from '$lib/stores/notifications';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  type Construction = {
    id: string;
    name: string;
    description: string;
    baseCost: { data: number; cpu: number; bandwidth: number };
    baseTime: number;
    prereqTech?: string;
    prereqConstruction?: Record<string, number>;
    img: string;
    bonus?: string;
  };

  const CONSTRUCTIONS: Construction[] = [
    { id: 'mineData', name: 'Mine de Données', description: 'Produit des données, la ressource principale du système.', baseCost: { data: 100, cpu: 0, bandwidth: 0 }, baseTime: 30, img: '/images/mine_data.png', bonus: 'Produit des données. +10%/niveau.' },
    { id: 'mineCPU', name: 'Mine de Cycles CPU', description: 'Produit des cycles CPU, ressource avancée pour unités puissantes.', baseCost: { data: 400, cpu: 0, bandwidth: 0 }, baseTime: 120, prereqConstruction: { mineData: 3 }, img: '/images/mine_cpu.png', bonus: 'Produit des cycles CPU. +10%/niveau.' },
    { id: 'mineBandwidth', name: 'Mine de Bande Passante', description: 'Produit de la bande passante, pour accélérer déplacements et constructions.', baseCost: { data: 300, cpu: 100, bandwidth: 0 }, baseTime: 90, prereqConstruction: { mineCPU: 3 }, img: '/images/mine_bandwidth.png', bonus: 'Produit de la bande passante. +10%/niveau.' },
    { id: 'dataStorage', name: 'Hangar de Données', description: 'Augmente la capacité maximale de stockage de données.', baseCost: { data: 300, cpu: 0, bandwidth: 0 }, baseTime: 30, img: '/images/hangar_data.png', bonus: '+1000 Data max/niveau.' },
    { id: 'cpuStorage', name: 'Hangar CPU', description: 'Augmente la capacité maximale de stockage de CPU.', baseCost: { data: 200, cpu: 100, bandwidth: 0 }, baseTime: 30, img: '/images/hangar_cpu.png', bonus: '+500 CPU max/niveau.' },
    { id: 'bandwidthStorage', name: 'Hangar de Bande Passante', description: 'Augmente la capacité maximale de stockage de bande passante.', baseCost: { data: 200, cpu: 0, bandwidth: 100 }, baseTime: 30, img: '/images/hangar_bandwidth.png', bonus: '+300 Bandwidth max/niveau.' },
    { id: 'shield', name: 'Bouclier Numérique', description: 'Renforce la défense passive du node.', baseCost: { data: 200, cpu: 50, bandwidth: 0 }, baseTime: 60, prereqConstruction: { mineData: 2 }, img: '/images/shield.png', bonus: 'Défense passive +10%/niveau.' },
    { id: 'activeDefense', name: 'Système de Défense Actif', description: 'Unités défensives automatiques pour protéger le node.', baseCost: { data: 500, cpu: 300, bandwidth: 0 }, baseTime: 300, prereqConstruction: { shield: 3 }, prereqTech: 'defenseTech', img: '/images/active_defense.png', bonus: 'Défense active améliorée.' },
    { id: 'firewall', name: 'Murs Firewall', description: 'Augmente la capacité et réduit les dégâts des attaques.', baseCost: { data: 400, cpu: 400, bandwidth: 100 }, baseTime: 240, prereqTech: 'firewallTech', img: '/images/firewall.png', bonus: 'Réduit les dégâts ennemis.' },
    { id: 'commandCenter', name: 'Centre de Commande', description: 'Augmente la capacité de gestion du node.', baseCost: { data: 300, cpu: 0, bandwidth: 0 }, baseTime: 90, img: '/images/command_center.png', bonus: 'Augmente la capacité.' },
    { id: 'researchLab', name: 'Laboratoire de Recherche', description: 'Permet de débloquer des technologies.', baseCost: { data: 600, cpu: 200, bandwidth: 100 }, baseTime: 180, prereqConstruction: { mineData: 4 }, img: '/images/research_lab.png', bonus: 'Débloque des technologies.' },
    { id: 'factory', name: 'Usine de Construction', description: 'Accélère la production des unités.', baseCost: { data: 500, cpu: 300, bandwidth: 200 }, baseTime: 150, prereqConstruction: { commandCenter: 2 }, img: '/images/factory.png', bonus: 'Production d’unités accélérée.' },
    { id: 'mineOptimization', name: 'Système d’Optimisation des Mines', description: 'Boost la production des mines de 10% par niveau.', baseCost: { data: 400, cpu: 400, bandwidth: 100 }, baseTime: 180, prereqConstruction: { researchLab: 3 }, img: '/images/mine_optimization.png', bonus: 'Boost production mines.' },
    { id: 'defenseOptimization', name: 'Optimisation de Défense', description: 'Augmente la défense passive de 10% par niveau.', baseCost: { data: 500, cpu: 500, bandwidth: 100 }, baseTime: 180, prereqConstruction: { activeDefense: 2 }, img: '/images/defense_optimization.png', bonus: 'Défense passive +10%/niveau.' },
    { id: 'transportNetwork', name: 'Réseau de Transport', description: 'Réduit le temps de déplacement des unités.', baseCost: { data: 700, cpu: 600, bandwidth: 400 }, baseTime: 300, prereqConstruction: { mineBandwidth: 4 }, img: '/images/transport_network.png', bonus: 'Déplacement plus rapide.' },
    { id: 'cryptographyCenter', name: 'Centre de Cryptographie', description: 'Améliore la furtivité des attaques.', baseCost: { data: 1000, cpu: 800, bandwidth: 300 }, baseTime: 360, prereqConstruction: { researchLab: 5 }, img: '/images/cryptography_center.png', bonus: 'Attaques furtives améliorées.' },
    { id: 'advancedServers', name: 'Serveurs de Calcul Avancés', description: 'Boost CPU et calcul pour flottes avancées.', baseCost: { data: 1500, cpu: 1200, bandwidth: 600 }, baseTime: 600, prereqConstruction: { researchLab: 8 }, img: '/images/advanced_servers.png', bonus: 'Augmente la puissance CPU.' },
    { id: 'surveillanceStation', name: 'Station de Surveillance', description: 'Permet d’espionner les nodes ennemis.', baseCost: { data: 800, cpu: 600, bandwidth: 200 }, baseTime: 300, prereqConstruction: { commandCenter: 3 }, prereqTech: 'espionnageTech', img: '/images/surveillance_station.png', bonus: 'Permet l’espionnage.' },
  ];

  let unlockedTechs = new Set(['defenseTech']);
  let user: User | null = null;
  let myNode: NodeData | null = null;
  let loading = true;
  let errorMsg = '';
  let upgradesInProgress: Record<string, number> = {};

  const currentTime = writable(Date.now());
  let intervalId: ReturnType<typeof setInterval>;
  let prodIntervalId: ReturnType<typeof setInterval>;

  async function fetchUserAndNode() {
    loading = true;
    if (!user) {
      loading = false;
      return;
    }
    try {
      const q = query(collection(db, 'nodes'), where('owner', '==', user.uid));
      const snap = await getDocs(q);
      myNode = snap.docs.length > 0 ? { id: snap.docs[0].id, ...snap.docs[0].data() } as NodeData : null;

      if (myNode) {
        resources.set({
          data: Number(myNode.resources?.data || 0),
          cpu: Number(myNode.resources?.cpu || 0),
          bandwidth: Number(myNode.resources?.bandwidth || 0),
        });
        const max = getStorageMax(myNode);
        maxResources.set({
          data: max.data,
          cpu: max.cpu,
          bandwidth: max.bandwidth,
        });
      } else {
        resources.set({ data: 0, cpu: 0, bandwidth: 0 });
        maxResources.set({ data: 0, cpu: 0, bandwidth: 0 });
      }

      upgradesInProgress = {};
      if (myNode?.upgrades) {
        for (const [key, val] of Object.entries(myNode.upgrades) as [string, number][]) {
          if (val && val > Date.now()) {
            upgradesInProgress[key] = val;
          }
        }
      }
    } catch {
      errorMsg = 'Erreur chargement node';
    }
    loading = false;
  }

  async function handleUpgradeFinished(buildingId: string) {
    if (!myNode) return;
    const nodeRef = doc(db, 'nodes', myNode.id);

    let levelPath;
    let currentLevel = getBuildingLevel(myNode, buildingId);

    if (buildingId === 'dataStorage') levelPath = 'storage.dataStorage.level';
    else if (buildingId === 'cpuStorage') levelPath = 'storage.cpuStorage.level';
    else if (buildingId === 'bandwidthStorage') levelPath = 'storage.bandwidthStorage.level';
    else if (buildingId === 'mineData') levelPath = 'mines.data.level';
    else if (buildingId === 'mineCPU') levelPath = 'mines.cpu.level';
    else if (buildingId === 'mineBandwidth') levelPath = 'mines.bandwidth.level';
    else levelPath = `constructions.${buildingId}`;

    const updateData: any = {};
    updateData[levelPath] = currentLevel + 1;
    updateData[`upgrades.${buildingId}`] = null;

    try {
      await updateDoc(nodeRef, updateData);
    } catch (err) {
      console.error("Erreur handleUpgradeFinished:", err);
    }
  }

  // Prod ressources toute les secondes (MAJ UI et DB synchrone)
  async function produceResources() {
    if (!myNode) return;
    if (loading || !user) return;

    const addData = getMineProduction(myNode, 'mineData');
    const addCpu = getMineProduction(myNode, 'mineCPU');
    const addBandwidth = getMineProduction(myNode, 'mineBandwidth');
    const max = getStorageMax(myNode);
    let localRes = get(resources);

    let newData = Math.min(localRes.data + addData, max.data);
    let newCpu = Math.min(localRes.cpu + addCpu, max.cpu);
    let newBandwidth = Math.min(localRes.bandwidth + addBandwidth, max.bandwidth);

    resources.set({
      data: newData,
      cpu: newCpu,
      bandwidth: newBandwidth
    });

    const nodeRef = doc(db, 'nodes', myNode.id);
    try {
      await updateDoc(nodeRef, {
        'resources.data': newData,
        'resources.cpu': newCpu,
        'resources.bandwidth': newBandwidth,
      });
      myNode.resources.data = newData;
      myNode.resources.cpu = newCpu;
      myNode.resources.bandwidth = newBandwidth;
    } catch (err) {
      console.error("Erreur production ressources:", err);
    }
  }

  function calcCost(base: number, level: number) {
    return Math.floor(base * Math.pow(1.5, level));
  }
  function calcTime(base: number, level: number) {
    return Math.floor(base * Math.pow(1.5, level));
  }
  function canAfford(cost: { data: number; cpu: number; bandwidth: number }) {
    if (!myNode) return false;
    const r = myNode.resources || { data: 0, cpu: 0, bandwidth: 0 };
    return r.data >= cost.data && r.cpu >= cost.cpu && r.bandwidth >= cost.bandwidth;
  }
  function meetsPrereqs(build: Construction): boolean {
    if (build.prereqTech && !unlockedTechs.has(build.prereqTech)) return false;
    if (build.prereqConstruction) {
      for (const [key, lvl] of Object.entries(build.prereqConstruction)) {
        if (getBuildingLevel(myNode, key) < lvl) return false;
      }
    }
    return true;
  }
  function isAnyUpgradeInProgress(): boolean {
    return Object.keys(upgradesInProgress).length > 0;
  }

  async function upgradeBuilding(buildingId: string) {
    if (!myNode) return;
    if (isAnyUpgradeInProgress()) {
      errorMsg = "Une autre amélioration est déjà en cours.";
      addNotification('warning', 'Upgrade en cours', 'Une amélioration est déjà en cours sur ce node');
      return;
    }
    const build = CONSTRUCTIONS.find(c => c.id === buildingId);
    if (!build) return;
    if (!meetsPrereqs(build)) {
      errorMsg = "Les prérequis ne sont pas remplis.";
      addNotification('warning', 'Prérequis manquants', 'Les prérequis pour cette construction ne sont pas remplis');
      return;
    }
    const buildingLevel = getBuildingLevel(myNode, buildingId);
    const cost = {
      data: calcCost(build.baseCost.data, buildingLevel),
      cpu: calcCost(build.baseCost.cpu, buildingLevel),
      bandwidth: calcCost(build.baseCost.bandwidth, buildingLevel),
    };
    if (!canAfford(cost)) {
      errorMsg = "Ressources insuffisantes pour cet upgrade";
      addNotification('warning', 'Ressources insuffisantes', 'Pas assez de ressources pour cette amélioration');
      return;
    }
    errorMsg = '';
    
    addNotification('info', 'Amélioration lancée', `Amélioration de ${build.name} démarrée`);
    
    try {
      const nodeRef = doc(db, 'nodes', myNode.id);
      const newResources = { ...myNode.resources };
      newResources.data -= cost.data;
      newResources.cpu -= cost.cpu;
      newResources.bandwidth -= cost.bandwidth;
      resources.set(newResources); // MAJ UI instant
      const upgradeDuration = calcTime(build.baseTime, buildingLevel) * 1000;
      const endTimestamp = Date.now() + upgradeDuration;
      const newUpgrades = { ...(myNode.upgrades || {}) };
      newUpgrades[buildingId] = endTimestamp;
      await updateDoc(nodeRef, {
        resources: newResources,
        upgrades: newUpgrades,
      });
      upgradesInProgress[buildingId] = endTimestamp;
    } catch (e) {
      errorMsg = "Erreur lors de l'upgrade";
      addNotification('error', 'Erreur', errorMsg);
      console.error('Upgrade error:', e);
      await fetchUserAndNode();
    }
  }

  onMount(() => {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      await fetchUserAndNode();

      intervalId = setInterval(async () => {
        currentTime.set(Date.now());
        let changed = false;
        for (const [key, endTime] of Object.entries(upgradesInProgress) as [string, number][]) {
          if (endTime <= get(currentTime)) {
            await handleUpgradeFinished(key);
            const build = CONSTRUCTIONS.find(c => c.id === key);
            if (build) {
              addNotification('success', 'Amélioration terminée', `${build.name} a été améliorée !`);
            }
            delete upgradesInProgress[key];
            changed = true;
          }
        }
        if (changed) fetchUserAndNode();
      }, 1000);

      prodIntervalId = setInterval(() => {
        produceResources();
      }, 1000);
    });
  });

  onDestroy(() => {
    clearInterval(intervalId);
    clearInterval(prodIntervalId);
  });

</script>

<style>
  ul.construction-list {
    display: grid;
    grid-template-columns: repeat(auto-fit,minmax(260px,1fr));
    gap: 1.5rem;
    padding: 0;
    list-style: none;
  }
  ul.construction-list li {
    border: 1px solid #444;
    border-radius: 12px;
    background: #222831;
    color: #eee;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1rem;
    box-shadow: 0 0 10px #000a;
    transition: box-shadow 0.3s ease;
    position: relative;
  }
  ul.construction-list li:hover {
    box-shadow: 0 0 18px #00bfa5;
  }
  .construction-img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 0.75rem;
  }
  .badge-level {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #00bfa5;
    color: #fff;
    font-weight: bold;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 0.8rem;
  }
  .construction-header {
    position: relative;
  }
  button.upgrade-btn {
    background: #00bfa5;
    color: white;
    font-weight: bold;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.3s ease;
  }
  button.upgrade-btn:hover:not(:disabled) {
    background: #019e8a;
  }
  button.upgrade-btn:disabled {
    background: #444;
    cursor: not-allowed;
  }
  .costs {
    font-size: 0.9rem;
    color: #ddd;
    margin-top: 0.4rem;
  }
  .costs span {
    margin-right: 0.8rem;
  }
  .prereqs {
    font-size: 0.85rem;
    color: #888;
    margin-top: 0.6rem;
    font-style: italic;
  }
  .timer {
    margin-top: 0.6rem;
    font-weight: 600;
    color: #00bfa5;
  }
  .bonus {
    margin-top: 0.3rem;
    font-size: 0.92rem;
    color: #5eead4;
  }
  .prod {
    font-size: 0.93rem;
    color: #d1fae5;
    margin-bottom: 0.3rem;
  }

  /* BONUS PANEL */
  .bonus-panel {
    background: #17202a;
    border-radius: 12px;
    padding: 1.2rem 1.5rem;
    color: #f7fafc;
    box-shadow: 0 2px 10px #0004;
    margin-bottom: 2rem;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
  .bonus-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.6rem;
    color: #68d391;
  }
  .bonus-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .bonus-list li {
    margin-bottom: 0.5rem;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .bonus-val {
    color: #facc15;
    font-weight: bold;
  }
</style>

<main class="max-w-7xl mx-auto p-6">
  <h1 class="text-4xl font-extrabold mb-6 text-center text-white">Constructions</h1>
  
  {#if myNode}
    {#key myNode.id}
      <div class="bonus-panel mb-6">
        <h3 class="bonus-title">Bonus Actifs</h3>
        {#if Object.values(getNodeBonuses(myNode)).some(v => v !== 0 && v !== 1)}
          <ul class="bonus-list">
            {#if getNodeBonuses(myNode).mineProductionMultiplier > 1}
              <li>⛏️ Production des mines : <span class="bonus-val">+{Math.round((getNodeBonuses(myNode).mineProductionMultiplier - 1) * 100)}%</span></li>
            {/if}
            {#if getNodeBonuses(myNode).passiveDefenseBonus > 0}
              <li>🛡️ Défense passive : <span class="bonus-val">+{Math.round(getNodeBonuses(myNode).passiveDefenseBonus * 100)}%</span></li>
            {/if}
            {#if getNodeBonuses(myNode).dataStorageBonus > 0}
              <li>💾 Stockage Data max : <span class="bonus-val">+{Math.round(getNodeBonuses(myNode).dataStorageBonus * 100)}%</span></li>
            {/if}
            {#if getNodeBonuses(myNode).cpuStorageBonus > 0}
              <li>⚡ Stockage CPU max : <span class="bonus-val">+{Math.round(getNodeBonuses(myNode).cpuStorageBonus * 100)}%</span></li>
            {/if}
            {#if getNodeBonuses(myNode).bandwidthStorageBonus > 0}
              <li>📡 Stockage Bande passante max : <span class="bonus-val">+{Math.round(getNodeBonuses(myNode).bandwidthStorageBonus * 100)}%</span></li>
            {/if}
          </ul>
        {:else}
          <span class="text-gray-400 italic">Aucun bonus actif</span>
        {/if}
      </div>
    {/key}
  {/if}
  
  {#if loading}
    <LoadingSpinner />
  {:else if !user}
    <p class="text-center text-white">Connecte-toi pour gérer tes constructions.</p>
  {:else if !myNode}
    <p class="text-center text-white">Tu n’as pas de node actif.</p>
  {:else}
    <p class="text-red-500 text-center mb-4">{errorMsg}</p>
    <ul class="construction-list">
      {#each CONSTRUCTIONS as build}
        {#if meetsPrereqs(build)}
          <li>
            <div class="construction-header">
              <img src={getConstructionImage(build.id)} alt={build.name} class="construction-img" />
              <div class="badge-level">
                Niveau {getBuildingLevel(myNode, build.id)}
              </div>
            </div>
            <h2 class="text-xl font-semibold mb-1">{build.name}</h2>
            <p>{build.description}</p>
            {#if build.id === 'mineData' || build.id === 'mineCPU' || build.id === 'mineBandwidth'}
              <p class="prod">
                Production : {getMineProduction(myNode, build.id)} /sec
                {#if getBuildingLevel(myNode, build.id) > 0}
                  <br />Prochain niveau : {Math.round(getMineProduction(myNode, build.id) * 1.1)} /sec
                {/if}
              </p>
            {/if}
            {#if build.id === 'dataStorage' || build.id === 'cpuStorage' || build.id === 'bandwidthStorage'}
              <div class="prod">
                Capacité max : 
                {getStorageMax(myNode)[
                  build.id === 'dataStorage' ? 'data' :
                  build.id === 'cpuStorage' ? 'cpu' : 'bandwidth'
                ]}
                {build.id === 'dataStorage' ? ' Data'
                  : build.id === 'cpuStorage' ? ' CPU'
                  : ' Bandwidth'}
                <br />Prochain niveau : 
                {getStorageMax({
                  ...myNode,
                  storage: {
                    ...myNode?.storage,
                    [build.id]: {
                      level: getBuildingLevel(myNode, build.id) + 1
                    }
                  }
                })[
                  build.id === 'dataStorage' ? 'data' :
                  build.id === 'cpuStorage' ? 'cpu' : 'bandwidth'
                ]}
                {build.id === 'dataStorage' ? ' Data'
                  : build.id === 'cpuStorage' ? ' CPU'
                  : ' Bandwidth'}
              </div>
            {/if}
            {#if build.bonus}
              <div class="bonus">{build.bonus}</div>
            {/if}
            <p class="costs">
              Coût upgrade : 
              <span>💾 {calcCost(build.baseCost.data, getBuildingLevel(myNode, build.id))}</span>
              <span>⚡ {calcCost(build.baseCost.cpu, getBuildingLevel(myNode, build.id))}</span>
              <span>📡 {calcCost(build.baseCost.bandwidth, getBuildingLevel(myNode, build.id))}</span>
            </p>
            <p class="costs">Temps : {calcTime(build.baseTime, getBuildingLevel(myNode, build.id))}s</p>
            {#if upgradesInProgress[build.id]}
              <p class="timer">
                Upgrade en cours : {Math.max(0, Math.ceil((upgradesInProgress[build.id] - $currentTime)/1000))}s restantes
              </p>
              <button class="upgrade-btn" disabled>En cours...</button>
            {:else}
              <button
                class="upgrade-btn"
                disabled={isAnyUpgradeInProgress() || !canAfford({
                  data: calcCost(build.baseCost.data, getBuildingLevel(myNode, build.id)),
                  cpu: calcCost(build.baseCost.cpu, getBuildingLevel(myNode, build.id)),
                  bandwidth: calcCost(build.baseCost.bandwidth, getBuildingLevel(myNode, build.id))
                })}
                on:click={() => upgradeBuilding(build.id)}
              >
                Améliorer
              </button>
            {/if}
          </li>
        {:else}
          <li class="border rounded-lg p-4 shadow bg-gray-900 text-gray-600 cursor-not-allowed">
            <h2 class="text-xl font-semibold mb-1">{build.name}</h2>
            <p class="prereqs">
              Débloqué après : 
              {#if build.prereqTech}
                technologie "{build.prereqTech}"
                {#if build.prereqConstruction}, {/if}
              {/if}
              {#if build.prereqConstruction}
                {#each Object.entries(build.prereqConstruction) as [key, lvl], i}
                  {key} niveau {lvl}{i < Object.entries(build.prereqConstruction).length - 1 ? ', ' : ''}
                {/each}
              {/if}
            </p>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</main>
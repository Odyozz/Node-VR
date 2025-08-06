<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth, db } from '$lib/firebase';
  import { doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
  import type { User } from 'firebase/auth';
  import { armyUnits } from '$lib/utils/units';
  import { getArmyUnitTimeWithBonus } from '$lib/utils/unitUtils';
  import type { NodeData, ArmyUnitKey, ArmyUnitDefinition, ArmyQueueItem } from '$lib/types';
  import { writable, get } from 'svelte/store';
  import { selectedNode } from '$lib/stores/selectedNode';

  let user: User | null = null;
  let loading = true;
  let errorMsg = '';

  let armyStock: Record<string, number> = {};
  let prodQueue: ArmyQueueItem[] = [];
  let qty: Record<string, number> = {};

  const currentTime = writable(Date.now());
  let intervalId: ReturnType<typeof setInterval>;

  $: myNode = $selectedNode;

  // Patch de récupération du node actif si null
  async function ensureSelectedNode() {
    if (!user) return;
    if (get(selectedNode)) return;
    const q = query(collection(db, "nodes"), where("owner", "==", user.uid));
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      const firstNode = { id: snap.docs[0].id, ...snap.docs[0].data() };
      selectedNode.set(firstNode);
    }
  }

  // Mise à jour automatique dès que le node sélectionné change (ou dès la MAJ Firestore)
  $: if (myNode) {
    armyStock = myNode.army?.units || {};
    prodQueue = myNode.army?.queue || [];
    for (const unit of armyUnits) {
      if (!(unit.key in qty)) qty[unit.key] = 1;
    }
  } else {
    armyStock = {};
    prodQueue = [];
  }

  // Lancement de la prod d'unités
  async function produceUnit(unitKey: ArmyUnitKey, quantity: number) {
    if (!myNode) return;
    const unit = armyUnits.find(u => u.key === unitKey);
    if (!unit) return;
    if (!isUnitUnlocked(unit, myNode)) {
      errorMsg = "Unité non débloquée";
      return;
    }
    if (quantity < 1) return;

    // Vérification ressources (spécifiques à CE node)
    const totalCost = {
      data: unit.baseCost.data * quantity,
      cpu: unit.baseCost.cpu * quantity,
      bandwidth: unit.baseCost.bandwidth * quantity,
    };
    const r = myNode.resources || { data: 0, cpu: 0, bandwidth: 0 };
    if (r.data < totalCost.data || r.cpu < totalCost.cpu || r.bandwidth < totalCost.bandwidth) {
      errorMsg = "Ressources insuffisantes";
      return;
    }

    // File prod locale
    const prodTime = getArmyUnitTimeWithBonus(myNode, unit);
    const now = Date.now();
    let lastEnd = prodQueue.length > 0 ? prodQueue[prodQueue.length-1].endsAt : now;
    const newQueue = [...prodQueue];
    for (let i = 0; i < quantity; i++) {
      lastEnd += prodTime * 1000;
      newQueue.push({ key: unitKey, qty: 1, endsAt: lastEnd });
    }

    // Débit ressources du node courant, puis MAJ en BDD
    const nodeRef = doc(db, 'nodes', myNode.id);
    const newResources = { ...myNode.resources };
    newResources.data -= totalCost.data;
    newResources.cpu -= totalCost.cpu;
    newResources.bandwidth -= totalCost.bandwidth;

    try {
      await updateDoc(nodeRef, {
        resources: newResources,
        'army.queue': newQueue,
      });
      errorMsg = '';
      // Patch local UI instantanée
      selectedNode.set({ ...myNode, resources: newResources, army: { ...myNode.army, queue: newQueue } });
    } catch (e) {
      errorMsg = "Erreur lors du lancement de la production";
    }
  }

  // Gestion de la fin de prod (tick 1s)
  async function handleProdFinished() {
    if (!myNode || prodQueue.length === 0) return;
    const now = Date.now();
    const done: ArmyQueueItem[] = prodQueue.filter(item => item.endsAt <= now);
    if (done.length === 0) return;
    const stillInQueue = prodQueue.filter(item => item.endsAt > now);

    const newStock = { ...armyStock };
    for (const item of done) {
      newStock[item.key] = (newStock[item.key] || 0) + (item.qty || 1);
    }
    const nodeRef = doc(db, 'nodes', myNode.id);
    await updateDoc(nodeRef, {
      'army.units': newStock,
      'army.queue': stillInQueue
    });
    // MAJ locale UI
    selectedNode.set({ ...myNode, army: { ...myNode.army, units: newStock, queue: stillInQueue } });
  }

  // Gestion déverrouillage unités
  function isUnitUnlocked(unit: ArmyUnitDefinition, node: NodeData | null): boolean {
    if (unit.key === 'dronePillard' || unit.key === 'gardienNumerique') return true;
    if (!node) return false;
    if (unit.prereqs?.construction) {
      for (const [c, lvl] of Object.entries(unit.prereqs.construction)) {
        if ((node.constructions?.[c] ?? 0) < lvl) return false;
      }
    }
    if (unit.prereqs?.tech) {
      for (const [t, lvl] of Object.entries(unit.prereqs.tech)) {
        if ((node.techs?.[t] ?? 0) < lvl) return false;
      }
    }
    return true;
  }

  // Prérequis manquants
  function getUnitMissingPrereqs(unit: ArmyUnitDefinition, node: NodeData | null): string[] {
    const out: string[] = [];
    if (!node) return out;
    if (unit.prereqs?.construction) {
      for (const [c, lvl] of Object.entries(unit.prereqs.construction)) {
        if ((node.constructions?.[c] ?? 0) < lvl) out.push(`Construction ${c} niveau ${lvl}`);
      }
    }
    if (unit.prereqs?.tech) {
      for (const [t, lvl] of Object.entries(unit.prereqs.tech)) {
        if ((node.techs?.[t] ?? 0) < lvl) out.push(`Techno ${t} niveau ${lvl}`);
      }
    }
    return out;
  }

  onMount(() => {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      // Assure qu'on a bien un node sélectionné après login ou navigation
      loading = false;
      await ensureSelectedNode();
      intervalId = setInterval(async () => {
        currentTime.set(Date.now());
        await handleProdFinished();
      }, 1000);
    });
  });

  onDestroy(() => {
    clearInterval(intervalId);
  });
</script>

<style>
  ul.army-list {
    display: grid;
    grid-template-columns: repeat(auto-fit,minmax(260px,1fr));
    gap: 1.5rem;
    padding: 0;
    list-style: none;
  }
  ul.army-list li {
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
    align-items: flex-start;
  }
  ul.army-list li:hover {
    box-shadow: 0 0 18px #00bfa5;
  }
  .army-img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 0.75rem;
  }
  .army-qty {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #00bfa5;
    color: #fff;
    font-weight: bold;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 0.95rem;
  }
  .army-header {
    position: relative;
    width: 100%;
  }
  .prod-btn {
    background: #00bfa5;
    color: white;
    font-weight: bold;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.3s ease;
    margin-top: 0.7rem;
  }
  .prod-btn:hover:not(:disabled) {
    background: #019e8a;
  }
  .prod-btn:disabled {
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
  .timer {
    margin-top: 0.6rem;
    font-weight: 600;
    color: #00bfa5;
  }
  .stats {
    font-size: 0.92rem;
    color: #5eead4;
    margin: 0.35rem 0 0.25rem 0;
  }
  .army-desc {
    font-size: 0.98rem;
    margin-bottom: 0.3rem;
  }
  .input-qty {
    width: 48px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid #444;
    background: #232a33;
    color: #fff;
    margin-left: 0.8rem;
    margin-right: 0.5rem;
    font-size: 1rem;
  }
  /* UNITS NON DEBLOQUEES */
  .locked {
    opacity: 0.5;
    filter: grayscale(0.8);
    pointer-events: none;
    background: #232a33 !important;
  }
  .locked-img {
    filter: grayscale(1) brightness(0.7);
  }
  .locked-msg {
    color: #bbb;
    font-style: italic;
    margin-top: 0.5rem;
  }
  .prereqs-list {
    color: #ffb454;
    font-size: 0.96rem;
    margin: 0.4rem 0 0 0.1rem;
    padding-left: 1.2rem;
  }
  .prod-bar {
  display: flex;
  align-items: center;
  gap: 1.3rem;
  background: #1c293a;
  border-radius: 18px;
  box-shadow: 0 4px 18px #0003;
  margin-bottom: 2.2rem;
  overflow-x: auto;
  padding: 1.2rem 1.1rem;
}
.prod-bar-title {
  min-width: 160px;
  color: #00bfa5;
  font-weight: bold;
  font-size: 1.2rem;
  letter-spacing: 0.02em;
}
.prod-bar-item {
  min-width: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 10px;
  border: 1.5px solid #00bfa5;
  background: #232a33;
  padding: 0.7rem 0.5rem;
  margin-right: 0.2rem;
}
.army-img-prod {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 0.2rem;
  border: 2px solid #00bfa5;
  background: #12202f;
}
.prod-bar-qty {
  color: #facc15;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 0.1rem;
}
.prod-bar-unit {
  font-size: 1rem;
  color: #fff;
  font-weight: 500;
  margin-bottom: 0.1rem;
  text-align: center;
}
.prod-bar-timer {
  font-size: 1rem;
  color: #68d391;
  font-family: monospace;
  margin-top: 0.08rem;
}

</style>

<main class="max-w-7xl mx-auto p-6">
  <h1 class="text-4xl font-extrabold mb-6 text-center text-white">Armée</h1>

  {#if loading}
    <p class="text-center text-white">Chargement...</p>
  {:else if !user}
    <p class="text-center text-white">Connecte-toi pour gérer ton armée.</p>
  {:else if !myNode}
    <p class="text-center text-white">Tu n’as pas de node actif. (Ceci ne devrait pas arriver !)</p>
  {:else}
    <p class="text-red-500 text-center mb-4">{errorMsg}</p>
    
    {#if prodQueue.length > 0}
      <div class="prod-bar mb-10">
        <div class="prod-bar-title">Production en cours :</div>
        {#each prodQueue as item (item.endsAt)}
          <div class="prod-bar-item">
            <img src={"/images/" + item.key + ".png"} alt={item.key} class="army-img-prod" />
            <div class="prod-bar-unit">{armyUnits.find(u => u.key === item.key)?.name}</div>
            <div class="prod-bar-qty">+{item.qty}</div>
            <div class="prod-bar-timer">
              {Math.max(0, Math.ceil((item.endsAt - $currentTime)/1000))}s
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <ul class="army-list">
      {#each armyUnits as unit}
        {#if isUnitUnlocked(unit, myNode)}
          <li>
            <div class="army-header">
              <img src={"/images/" + unit.key + ".png"} alt={unit.name} class="army-img" />
              <div class="army-qty">
                x{armyStock[unit.key] || 0}
              </div>
            </div>
            <h2 class="text-xl font-semibold mb-1">{unit.name}</h2>
            <p class="army-desc">{unit.description}</p>
            <div class="stats">
              Attaque : <b>{unit.attack || 0}</b> | Défense : <b>{unit.defense || 0}</b> | Vitesse : <b>{unit.speed || 0}</b> | Transport : <b>{unit.capacity ?? '-'}</b>
            </div>
            <p class="costs">
              Coût recrutement :
              <span>💾 {unit.baseCost.data}</span>
              <span>⚡ {unit.baseCost.cpu}</span>
              <span>📡 {unit.baseCost.bandwidth}</span>
            </p>
            <p class="costs">Temps : {getArmyUnitTimeWithBonus(myNode, unit)}s</p>
            <input class="input-qty" type="number" min="1" bind:value={qty[unit.key]} />
            <button class="prod-btn"
              on:click={() => produceUnit(unit.key, qty[unit.key])}
            >
              Recruter
            </button>
          </li>
        {:else}
          <li class="border rounded-lg p-4 shadow bg-gray-900 text-gray-600 cursor-not-allowed opacity-60 relative">
            <div class="army-header">
              <img src={"/images/" + unit.key + ".png"} alt={unit.name} class="army-img grayscale opacity-40" />
              <div class="army-qty">x{armyStock[unit.key] || 0}</div>
            </div>
            <h2 class="text-xl font-semibold mb-1">{unit.name}</h2>
            <p class="army-desc">{unit.description}</p>
            <div class="stats">
              Attaque : <b>{unit.attack || 0}</b> | Défense : <b>{unit.defense || 0}</b> | Vitesse : <b>{unit.speed || 0}</b> | Transport : <b>{unit.capacity ?? '-'}</b>
            </div>
            <p class="costs">
              Coût recrutement :
              <span>💾 {unit.baseCost.data}</span>
              <span>⚡ {unit.baseCost.cpu}</span>
              <span>📡 {unit.baseCost.bandwidth}</span>
            </p>
            <p class="costs">Temps : {getArmyUnitTimeWithBonus(myNode, unit)}s</p>
            <div class="prereqs">
              Débloqué après :<br />
              {#each getUnitMissingPrereqs(unit, myNode) as req, i}
                <span>{req}{i < getUnitMissingPrereqs(unit, myNode).length - 1 ? ', ' : ''}</span>
              {/each}
            </div>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</main>

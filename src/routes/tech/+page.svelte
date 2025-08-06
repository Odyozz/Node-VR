<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth, db } from '$lib/firebase';
  import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
  import type { User } from 'firebase/auth';
  import { technologyTree, type TechnologyNode } from '$lib/utils/technologies';
  import { resources } from '$lib/stores/resources';
  import { maxResources } from '$lib/stores/maxResources';
  import { get, writable } from 'svelte/store';
  import { getMineProduction, getStorageMax } from '$lib/utils/nodeUtils';

  const BRANCHES = ['construction', 'armyUnlock', 'prodBoost', 'armyBoost'];

  let myNode: any = null;
  let user: User | null = null;
  let loading = true;
  let errorMsg = '';

  let unlockedTechs: Record<string, boolean> = {};
  let currentResearch: string | null = null;
  let researchEndTime: number | null = null;

  let popupTech: TechnologyNode | null = null;
  let popupPos = { x: 0, y: 0 };
  let popupSticky = false;

  const currentTime = writable(Date.now());
  let intervalId: ReturnType<typeof setInterval>;
  let prodIntervalId: ReturnType<typeof setInterval>;
  let nodeUnsub: any = null;

  // Correction: chaque tech = 1 ligne, strictement vertical
  let branchLevels: Record<string, TechnologyNode[][]> = {};
  $: branchLevels = Object.fromEntries(
    BRANCHES.map(b => [b, getBranchLevels(b)])
  );

  function getLevel(node: any, key: string): number {
    if (!node) return 0;
    switch (key) {
      case 'mineData': return node?.mines?.data?.level ?? 0;
      case 'mineCPU': return node?.mines?.cpu?.level ?? 0;
      case 'mineBandwidth': return node?.mines?.bandwidth?.level ?? 0;
      case 'dataStorage': return node?.storage?.dataStorage?.level ?? 0;
      case 'cpuStorage': return node?.storage?.cpuStorage?.level ?? 0;
      case 'bandwidthStorage': return node?.storage?.bandwidthStorage?.level ?? 0;
      default: return node?.constructions?.[key] ?? 0;
    }
  }

  function nomAffichage(bid: string): string {
    switch (bid) {
      case 'shield': return 'Bouclier Numérique';
      case 'activeDefense': return 'Défense Active';
      case 'firewall': return 'Murs Firewall';
      case 'surveillanceStation': return 'Station de Surveillance';
      case 'mineOptimization': return 'Optimisation des Mines';
      case 'defenseOptimization': return 'Optimisation de Défense';
      case 'commandCenter': return 'Centre de Commande';
      case 'researchLab': return 'Laboratoire de Recherche';
      case 'factory': return 'Usine de Construction';
      case 'transportNetwork': return 'Réseau de Transport';
      case 'cryptographyCenter': return 'Centre de Cryptographie';
      case 'advancedServers': return 'Serveurs de Calcul Avancés';
      case 'dataStorage': return 'Hangar de Données';
      case 'cpuStorage': return 'Hangar CPU';
      case 'bandwidthStorage': return 'Hangar Bande Passante';
      case 'mineData': return 'Mine de Données';
      case 'mineCPU': return 'Mine CPU';
      case 'mineBandwidth': return 'Mine de Bande Passante';
      default: return bid;
    }
  }

  // Correction: vertical, une tech par ligne
  function getBranchLevels(branch: string): TechnologyNode[][] {
    const branchTechs = technologyTree.filter(t => t.branch === branch);
    // Trie par un champ si besoin (genre order, id...)
    return branchTechs.map(t => [t]);
  }

  async function fetchUserTech() {
    loading = true;
    if (!user) { loading = false; return; }
    try {
      const userRef = doc(db, 'players', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        unlockedTechs = data.unlockedTechs || {};
        currentResearch = data.currentResearch || null;
        researchEndTime = data.researchEndTime || null;
      }
    } catch (e) {
      errorMsg = "Erreur chargement technologies";
    }
    loading = false;
  }

  function hasEnoughResources(node: any, tech: TechnologyNode): boolean {
    if (!node || !tech) return false;
    return node.resources.data >= tech.cost.data &&
           node.resources.cpu >= tech.cost.cpu &&
           node.resources.bandwidth >= tech.cost.bandwidth;
  }

  async function startResearch(tech: TechnologyNode) {
    if (!user) return;
    if (currentResearch) {
      errorMsg = "Une recherche est déjà en cours !";
      return;
    }
    if (!myNode) {
      errorMsg = "Node joueur introuvable.";
      return;
    }
    if (!hasEnoughResources(myNode, tech)) {
      errorMsg = "Pas assez de ressources !";
      return;
    }
    const end = Date.now() + tech.time * 1000;
    const userRef = doc(db, 'players', user.uid);
    const nodeRef = doc(db, 'nodes', myNode.id);

    try {
      const newRes = {
        data: myNode.resources.data - tech.cost.data,
        cpu: myNode.resources.cpu - tech.cost.cpu,
        bandwidth: myNode.resources.bandwidth - tech.cost.bandwidth
      };
      await updateDoc(nodeRef, {
        "resources.data": newRes.data,
        "resources.cpu": newRes.cpu,
        "resources.bandwidth": newRes.bandwidth
      });
      myNode.resources = { ...newRes };
      resources.set({ ...newRes });
      await updateDoc(userRef, {
        currentResearch: tech.key,
        researchEndTime: end,
      });
      currentResearch = tech.key;
      researchEndTime = end;
      errorMsg = '';
      hidePopup(true);
    } catch (e) {
      errorMsg = "Erreur Firestore : " + (e?.message ?? e);
      console.error(e);
    }
  }

  async function finishResearch() {
    if (!user || !currentResearch) return;
    const userRef = doc(db, 'players', user.uid);
    const unlocked = { ...unlockedTechs, [currentResearch]: true };
    await updateDoc(userRef, {
      unlockedTechs: unlocked,
      currentResearch: null,
      researchEndTime: null,
    });
    unlockedTechs = unlocked;
    currentResearch = null;
    researchEndTime = null;
  }

  function canResearch(tech: TechnologyNode): boolean {
    if (unlockedTechs[tech.key]) return false;
    if (currentResearch) return false;
    if (tech.prereqs) {
      for (const req of tech.prereqs)
        if (!unlockedTechs[req]) return false;
    }
    if (tech.buildingPrereqs) {
      for (const [bid, lvl] of Object.entries(tech.buildingPrereqs)) {
        if (getLevel(myNode, bid) < lvl) return false;
      }
    }
    return true;
  }

  function showPopup(tech: TechnologyNode, evt: MouseEvent | TouchEvent, sticky = false) {
    popupTech = tech;
    popupSticky = sticky;
    let target: HTMLElement | null = null;
    if (evt instanceof MouseEvent) {
      target = evt.target as HTMLElement;
    } else if (evt instanceof TouchEvent && evt.touches.length) {
      target = evt.touches[0].target as HTMLElement;
    }
    if (target) {
      const rect = target.getBoundingClientRect();
      popupPos = {
        x: rect.left + rect.width / 2,
        y: rect.top - 12,
      };
    }
  }
  function hidePopup(force = false) {
    if (popupSticky && !force) return;
    popupTech = null;
    popupSticky = false;
  }
  function handleClickOutside(e: MouseEvent) {
    if (popupSticky) {
      const popup = document.querySelector('.popup');
      if (popup && !popup.contains(e.target as Node)) {
        hidePopup(true);
      }
    }
  }

  async function produceResources() {
    if (!myNode) return;
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

  async function listenUserNodeRealtime() {
    if (!user) return;
    const q = query(collection(db, 'nodes'), where('owner', '==', user.uid));
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      const docRef = doc(db, 'nodes', snap.docs[0].id);
      if (nodeUnsub) nodeUnsub();
      nodeUnsub = onSnapshot(docRef, (d) => {
        myNode = { id: d.id, ...d.data() };
        if (myNode && myNode.resources) {
          resources.set({
            data: myNode.resources.data,
            cpu: myNode.resources.cpu,
            bandwidth: myNode.resources.bandwidth
          });
          maxResources.set(getStorageMax(myNode));
        }
      });
    }
  }

  onMount(() => {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      await fetchUserTech();
      await listenUserNodeRealtime();
      intervalId = setInterval(() => currentTime.set(Date.now()), 1000);
      prodIntervalId = setInterval(() => {
        produceResources();
      }, 1000);
    });
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    clearInterval(intervalId);
    clearInterval(prodIntervalId);
    document.removeEventListener('mousedown', handleClickOutside);
    if (nodeUnsub) nodeUnsub();
  });

  $: if (currentResearch && researchEndTime && $currentTime > (researchEndTime ?? 0)) {
    finishResearch();
  }
</script>

<style>
.tree-root {
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 2.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.branch-col {
  min-width: 250px;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.branch-title {
  font-size: 1.18rem;
  font-weight: 700;
  color: #ffe066;
  margin-bottom: 0.7rem;
  background: #222832;
  padding: 0.32em 1em;
  border-radius: 7px;
  margin-top: 0.6rem;
  letter-spacing: 0.7px;
}
.tech-grid {
  position: relative;
  width: 200px;
  margin: 0 auto;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  gap: 30px;
  z-index: 1;
}
.tech-row {
  display: flex;
  justify-content: center;
  gap: 0px;
}

/* ---- TECH SQUARE ---- */
.tech-square {
  width: 96px;
  height: 112px;
  background: linear-gradient(120deg, #212c3b 90%, #10131b 100%);
  border: 3.5px solid #39415b;
  border-radius: 18px;
  box-shadow: 0 2px 20px #000b, 0 0 0px 2px #27f6bf10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  font-size: 1.10em;
  font-weight: 700;
  color: #ffdcae;
  cursor: pointer;
  position: relative;
  transition: transform 0.13s, box-shadow 0.17s, border 0.14s;
  user-select: none;
  padding: 9px 0 0 0;
  overflow: visible;
}
.tech-square:hover:not(.locked):not(.no-resource):not(.unlocked):not(.in-progress) {
  box-shadow: 0 6px 32px #33ffc29f, 0 0 0px 3px #42fff940;
  border-color: #27f6bf;
  transform: translateY(-5px) scale(1.05);
  z-index: 3;
}
.tech-square.unlocked {
  border-color: #72ffc2;
  background: linear-gradient(120deg, #1ec881 80%, #083e19 100%);
  color: #fff;
  box-shadow: 0 0 28px #7fffd49a;
  opacity: 0.92;
}
.tech-square.deblocable {
  border-color: #a1ff68;
  box-shadow: 0 0 34px #edffb478;
  animation: blinkGlow 1.1s infinite alternate;
}
@keyframes blinkGlow { to { box-shadow: 0 0 38px #b2ffb7c2; } }
.tech-square.locked {
  border-style: dashed;
  border-color: #889;
  background: #25282f;
  color: #a3b2c2;
  opacity: 0.42;
  cursor: not-allowed;
}
.tech-square.in-progress {
  border-color: #4fc3f7;
  background: linear-gradient(90deg, #1e386f 60%, #243752 100%);
  box-shadow: 0 0 32px #52b1f9c8;
  animation: blinkGlow 0.8s infinite alternate;
}
.tech-square.no-resource {
  border-color: #df6565 !important;
  background: linear-gradient(120deg, #2c2323 90%, #1b1515 100%) !important;
  color: #e4baba !important;
  opacity: 0.46;
  cursor: not-allowed;
  filter: grayscale(0.35) blur(0.5px);
  position: relative;
}
.tech-square.no-resource::after {
  content: "⛔";
  position: absolute;
  right: 10px;
  bottom: 9px;
  font-size: 1.5em;
  color: #df6565;
  opacity: 0.82;
  pointer-events: none;
}
.tech-square .lock {
  position: absolute;
  top: 9px; left: 12px;
  font-size: 1.35em;
  color: #8fb4ce;
  opacity: 0.75;
  pointer-events: none;
}

/* ---- IMAGE & TITLE ---- */
.tech-square .tech-img {
  width: 44px;
  height: 44px;
  margin-bottom: 7px;
  border-radius: 9px;
  box-shadow: 0 2px 8px #0008;
  object-fit: cover;
  background: #191d24;
  border: 1.5px solid #3fffc250;
  display: block;
}
.tech-square .tech-title {
  font-size: 1.02em;
  font-weight: 600;
  color: #ffe3a0;
  text-align: center;
  padding: 3px 4px 0 4px;
  line-height: 1.16;
  min-height: 2.4em;
  word-break: break-word;
}
.tech-square .tech-short {
  font-size: 2em;
  font-weight: 800;
  color: #ffdcae;
  margin-top: 8px;
}

/* ---- POPUP ---- */
.popup {
  position: fixed;
  min-width: 220px;
  max-width: 340px;
  background: #181c23;
  color: #f3f8fc;
  border-radius: 12px;
  padding: 1.2em 1.4em;
  box-shadow: 0 0 32px #1ee0bba8, 0 2px 24px #0007;
  z-index: 99;
  pointer-events: all;
  transition: opacity 0.17s;
  font-size: 1.01em;
  border: 2px solid #3fffc2;
  top: 0; left: 0;
  transform: translate(-50%, -105%);
}
.popup .title {
  font-size: 1.1em;
  font-weight: bold;
  color: #ffe496;
  margin-bottom: 0.25em;
}
.popup .desc {
  color: #c2ffe1;
  margin-bottom: 0.32em;
}
.popup .costs {
  color: #ffe066;
  font-size: 0.95em;
  margin-bottom: 0.16em;
}
.popup .prereqs {
  color: #b1c1e3;
  font-size: 0.91em;
  margin-top: 0.1em;
}
.popup .prereqs .nok {
  color: #fc6666;
  margin-left: 6px;
  font-size: 1em;
  font-weight: bold;
}
.popup .btn {
  background: #33ffab;
  color: #183e26;
  font-weight: 700;
  padding: 0.31em 1.14em;
  border-radius: 7px;
  border: none;
  font-size: 1.07em;
  margin-top: 0.6em;
  cursor: pointer;
  transition: background 0.11s;
}
.popup .btn:disabled {
  background: #aaa;
  color: #222;
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Responsive ---- */
@media (max-width: 700px) {
  .tree-root { flex-direction: column; gap: 1.1rem; }
  .tech-grid { width: 98vw; }
  .tech-row { gap: 2vw; }
  .tech-square { width: 76vw; max-width: 132px; min-width: 62px; height: 90vw; max-height: 140px;}
  .tech-square .tech-img { width: 32px; height: 32px; }
}
</style>

<main class="max-w-7xl mx-auto">
  <h1 class="text-4xl font-extrabold mb-10 text-center text-white drop-shadow-lg tracking-wide">Arbre Technologique</h1>
  {#if loading}
    <p class="text-center text-white">Chargement...</p>
  {:else if !user}
    <p class="text-center text-white">Connecte-toi pour voir ton arbre technologique.</p>
  {:else}
    <p class="text-red-500 text-center mb-4">{errorMsg}</p>
    <div class="tree-root">
      {#each BRANCHES as branch (branch)}
        <div class="branch-col">
          <div class="branch-title">
            {branch === 'construction' ? 'Bâtiments'
              : branch === 'armyUnlock' ? 'Unités'
              : branch === 'prodBoost' ? 'Production'
              : branch === 'armyBoost' ? 'Armée'
              : branch}
          </div>
          <div class="tech-grid" style="height: {branchLevels[branch].length * 120 + 30}px;">
            {#each branchLevels[branch] as row, d}
              <div class="tech-row" style="margin-bottom: {d < branchLevels[branch].length - 1 ? 0 : 10}px;">
                {#each row as tech (tech.key)}
                  {@const isUnlocked = unlockedTechs[tech.key]}
                  {@const isInProgress = currentResearch === tech.key}
                  {@const isDeblocable = canResearch(tech) && !isUnlocked && !isInProgress}
                  {@const isLocked = !canResearch(tech) && !isUnlocked && !isInProgress}
                  {@const noResource = isDeblocable && !hasEnoughResources(myNode, tech)}
                  <div
  class="tech-square
    {isUnlocked ? 'unlocked' : ''}
    {isInProgress ? 'in-progress' : ''}
    {isDeblocable && !noResource ? 'deblocable' : ''}
    {isLocked ? 'locked' : ''}
    {noResource ? 'no-resource' : ''}"
  tabindex="0"
  aria-label={tech.name}
  on:mouseenter={(e) => !popupSticky && showPopup(tech, e)}
  on:mouseleave={(e) => !popupSticky && hidePopup()}
  on:click={(e) => {
    if (isDeblocable && !noResource)
      showPopup(tech, e, true)
  }}
>
  <span class="tech-title">{tech.name}</span>
  {#if isLocked}
    <span class="lock">🔒</span>
  {/if}
</div>

                {/each}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    {#if popupTech}
      <div
        class="popup"
        style="left: {popupPos.x}px; top: {popupPos.y}px;"
      >
        <div class="title">{popupTech.name}</div>
        <div class="desc">{popupTech.description}</div>
        <div class="costs">
          ⏳ {popupTech.time}s | 💾 {popupTech.cost.data} | ⚡ {popupTech.cost.cpu} | 📡 {popupTech.cost.bandwidth}
        </div>
        {#if popupTech.prereqs && popupTech.prereqs.length}
          <div class="prereqs">
            Prérequis :
            {#each popupTech.prereqs as req, i}
              <span>
                {technologyTree.find(t => t.key === req)?.name || req}
                {#if !unlockedTechs[req]}<span class="nok">⛔</span>{/if}
                {i < popupTech.prereqs.length - 1 ? ', ' : ''}
              </span>
            {/each}
          </div>
        {/if}
        {#if popupTech.buildingPrereqs}
          <div class="prereqs">
            {#each Object.entries(popupTech.buildingPrereqs) as [bid, lvl]}
              <span>
                {nomAffichage(bid)} niveau {lvl}
                {#if myNode && getLevel(myNode, bid) < lvl}
                  <span class="nok">⛔</span>
                {/if}
              </span>
            {/each}
          </div>
        {/if}
        {#if unlockedTechs[popupTech.key]}
          <div class="unlocked-text">Débloquée</div>
        {:else if currentResearch === popupTech.key}
          <div class="in-progress-text">
            En cours : {Math.max(0, Math.ceil((researchEndTime ?? 0 - $currentTime) / 1000))}s
          </div>
        {:else if canResearch(popupTech)}
          <button class="btn"
            on:click={() => startResearch(popupTech)}
            disabled={!hasEnoughResources(myNode, popupTech)}>
            Rechercher
          </button>
        {/if}
        <button class="btn" style="margin-top:0.8em;background:#222;color:#fff" on:click={() => hidePopup(true)}>
          Fermer
        </button>
      </div>
    {/if}
  {/if}
</main>

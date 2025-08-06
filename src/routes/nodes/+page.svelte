<script lang="ts">
  import { auth, db } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { collection, query, where, getDocs } from 'firebase/firestore';
  import { writable, get } from 'svelte/store';
  import type { User } from "firebase/auth";
  import { goto } from '$app/navigation';

  // === Store global node sélectionné (exporté)
  export const selectedNode = writable<any>(null);

  let user: User | null = null;
  let myNodes: any[] = [];
  let loading = true;
  let errorMsg = '';

  let selected: any = null; // Node actuellement sélectionné (local)

  // Helper pour prod/heure
  function getMineProduction(level: number) {
    return Math.floor(10 * Math.pow(1.35, level - 1));
  }
  function getTotalProd(node, resType: 'data'|'cpu'|'bandwidth') {
    if (!node?.mines) return 0;
    const mine = node.mines[resType];
    return mine ? getMineProduction(mine.level) * 3600 : 0; // par heure
  }

  onMount(async () => {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      if (!user) {
        goto('/'); // Redirection auto
        return;
      }
      await loadMyNodes();
    });
  });

  async function loadMyNodes() {
    loading = true;
    errorMsg = '';
    if (!user) return;
    try {
      const q = query(collection(db, "nodes"), where("owner", "==", user!.uid));
      const snap = await getDocs(q);
      myNodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sélectionne automatiquement un node si aucun n'est sélectionné (ou après suppression)
      if (myNodes.length > 0) {
        // Si pas déjà sélectionné (ex: navigation/réactualisation)
        if (!get(selectedNode) || !myNodes.some(n => n.id === get(selectedNode)?.id)) {
          selected = myNodes[0];
          selectedNode.set(selected);
        } else {
          selected = get(selectedNode);
        }
      } else {
        selected = null;
        selectedNode.set(null);
      }
    } catch (e) {
      errorMsg = "Erreur lors du chargement de tes nodes.";
    }
    loading = false;
  }

  function selectNode(node) {
    selected = node;
    selectedNode.set(node);
  }
</script>

<style>
.node-list {
  display: flex;
  gap: 2.5rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
  justify-content: center;
}
.node-card {
  background: linear-gradient(120deg, #222d3b 80%, #181f27 100%);
  border: 3px solid #2cecff40;
  border-radius: 16px;
  min-width: 220px;
  max-width: 340px;
  box-shadow: 0 2px 18px #0009;
  padding: 1.5rem 2rem 1.1rem 2rem;
  cursor: pointer;
  transition: border 0.18s, box-shadow 0.22s, transform 0.14s;
  position: relative;
  outline: none;
  margin-bottom: 0.7rem;
}
.node-card.selected {
  border: 3.5px solid #5fffc2;
  box-shadow: 0 6px 28px #33ffc259;
  transform: scale(1.055) translateY(-5px);
  z-index: 3;
}
.node-card .coords {
  font-size: 1rem;
  color: #5eead4;
  font-weight: bold;
  margin-bottom: 0.2em;
  letter-spacing: 0.03em;
}
.node-card .node-name {
  font-size: 1.23em;
  font-weight: 800;
  color: #ffe080;
  margin-bottom: 0.22em;
}
.node-card .prod {
  font-size: 0.98em;
  color: #b2ebf2;
  margin-bottom: 0.15em;
}
.node-card .prod span {
  margin-right: 1.1em;
}
.node-card .storage {
  color: #a1c9e7;
  font-size: 0.94em;
  margin-bottom: 0.14em;
  margin-top: 0.2em;
}
.node-card .main-label {
  position: absolute;
  top: 9px; right: 15px;
  background: #00bfa5;
  color: #fff;
  font-size: 0.93em;
  font-weight: 700;
  border-radius: 8px;
  padding: 3px 14px 2px 14px;
  letter-spacing: 0.04em;
  box-shadow: 0 2px 8px #0005;
}
@media (max-width: 800px) {
  .node-list { flex-direction: column; gap: 1.2rem; align-items: center;}
  .node-card { width: 90vw; min-width: unset; max-width: unset; }
}
</style>

<main class="max-w-5xl mx-auto p-6">
  <h1 class="text-3xl font-extrabold mb-6 text-center text-white drop-shadow-lg">Mes Nodes</h1>
  {#if loading}
    <p class="text-center text-white">Chargement...</p>
  {:else if !user}
    <p class="text-center text-white">Connecte-toi pour voir tes nodes.</p>
  {:else if myNodes.length === 0}
    <p class="text-center text-white">Tu n’as aucun node.</p>
  {:else}
    <div class="node-list">
      {#each myNodes as node}
        <div class="node-card {selected && selected.id === node.id ? 'selected' : ''}" on:click={() => selectNode(node)} tabindex="0">
          {#if myNodes[0].id === node.id}
            <span class="main-label">Node principal</span>
          {/if}
          <div class="coords">({node.pos?.x ?? '—'},{node.pos?.y ?? '—'})</div>
          <div class="node-name">{node.name}</div>
          <div class="prod">
            💾 {getTotalProd(node, 'data')} /h
            <span>⚡ {getTotalProd(node, 'cpu')} /h</span>
            <span>📡 {getTotalProd(node, 'bandwidth')} /h</span>
          </div>
          <div class="storage">
            Capacité de stockage : 💾 {node?.storage?.dataStorage?.level ?? 1} | ⚡ {node?.storage?.cpuStorage?.level ?? 1} | 📡 {node?.storage?.bandwidthStorage?.level ?? 1}
          </div>
        </div>
      {/each}
    </div>
    <div>
      <h2 class="text-2xl font-bold mb-4 mt-4 text-cyan-300">Node sélectionné</h2>
      <div class="bg-[#181f28] border border-cyan-900 rounded-lg p-6 mb-6">
        <div class="text-lg font-semibold text-white mb-2">{selected?.name}</div>
        <div class="text-gray-400 mb-2">Coordonnées : <b>({selected?.pos?.x},{selected?.pos?.y})</b></div>
        <div class="mb-1 text-gray-300">
          <b>Production par heure :</b>
          <div>💾 Données : {getTotalProd(selected, 'data')}</div>
          <div>⚡ CPU : {getTotalProd(selected, 'cpu')}</div>
          <div>📡 Bande passante : {getTotalProd(selected, 'bandwidth')}</div>
        </div>
        <div class="mt-2 text-gray-400">
          <b>Capacité stockage</b> : 💾 {selected?.storage?.dataStorage?.level ?? 1}
          | ⚡ {selected?.storage?.cpuStorage?.level ?? 1}
          | 📡 {selected?.storage?.bandwidthStorage?.level ?? 1}
        </div>
      </div>
    </div>
  {/if}
  {#if errorMsg}
    <p class="text-center text-red-500 mt-4">{errorMsg}</p>
  {/if}
</main>

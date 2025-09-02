<script lang="ts">
  import { auth, db } from '$lib/firebase';
  import { assignRandomNodeToUser } from '$lib/assignNode';
  import { onMount, onDestroy } from 'svelte';
  import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import type { User } from "firebase/auth";
  import { resources } from '$lib/stores/resources';
  import { maxResources } from '$lib/stores/maxResources';
  import ResourceBar from '$lib/components/ResourceBar.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import { addNotification } from '$lib/stores/notifications';
  import { getMineProduction } from '$lib/utils/nodeUtils';

  let user: User | null = null;
  let myNodes: any[] = [];
  let loading = true;
  let errorMsg = '';

  let unsubNodes: Unsubscribe | null = null;
  let unsubAuth: any = null;

  async function assignSpawnNode() {
    if (!user) return;
    try {
      await assignRandomNodeToUser(user);
      addNotification('success', 'Node assigné', 'Votre premier node vous a été assigné avec succès !');
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      addNotification('error', 'Erreur', errorMsg);
    }
  }

  function subscribeNodes() {
    if (!user) return;
    if (unsubNodes) unsubNodes();
    loading = true;
    const q = query(collection(db, "nodes"), where("owner", "==", user.uid));
    unsubNodes = onSnapshot(q, async (snap) => {
      myNodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Si pas de node => assignation automatique
      if (myNodes.length === 0) {
        await assignSpawnNode();
      } else {
        // Notification de bienvenue pour les utilisateurs existants
        if (myNodes.length === 1) {
          addNotification('info', 'Bienvenue', 'Gérez vos ressources et développez votre empire numérique !', false);
        }
      }
      loading = false;
    });
  }

  onMount(() => {
    unsubAuth = auth.onAuthStateChanged(async (u) => {
      user = u;
      if (!user) {
        goto('/'); // Redirection si non connecté
        return;
      }
      subscribeNodes();
    });
  });

  onDestroy(() => {
    if (unsubNodes) unsubNodes();
    if (unsubAuth) unsubAuth();
  });
</script>

<style>
  .dashboard {
    font-family: 'Poppins', sans-serif;
    color: #cfd2d6;
    padding: 2rem;
    background: #121212;
    min-height: 100vh;
  }
  h2 {
    font-weight: 700;
    font-size: 2rem;
    margin-bottom: 1rem;
    color: #aabedc;
    text-shadow: 0 0 5px #5a7fa8;
  }
  .section {
    background: rgba(30, 30, 47, 0.75);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 0 15px #0008;
  }
  .resources {
    display: flex;
    gap: 2.5rem;
    font-weight: 600;
    font-size: 1.25rem;
    color: #d5d9e3;
  }
  .resources div {
    background: #1e1e2f;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    box-shadow: inset 0 0 8px #2a3b5a;
    flex: 1;
    text-align: center;
  }
  ul.nodes {
    list-style: none;
    padding: 0;
  }
  ul.nodes li {
    background: #1e1e2f;
    margin-bottom: 0.7rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    box-shadow: 0 0 6px #000a;
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }
  ul.nodes li b {
    color: #5a7fa8;
  }
  .alert {
    color: #d17b7b;
    font-style: italic;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .stat-card {
    background: rgba(30, 30, 47, 0.75);
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid rgba(90, 127, 168, 0.3);
  }
  .stat-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #aabedc;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .node-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #1e1e2f;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }
  .node-name {
    font-weight: 600;
    color: #5a7fa8;
  }
  .node-coords {
    color: #34d399;
    font-size: 0.9rem;
  }
  .production-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 1rem;
  }
  .prod-item {
    text-align: center;
    padding: 8px;
    background: rgba(52, 211, 153, 0.1);
    border-radius: 6px;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }
  .prod-value {
    font-weight: 700;
    font-size: 1.1rem;
    color: #34d399;
  }
  .prod-label {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 2px;
  }
</style>

<div class="dashboard">
  <h2>Tableau de bord</h2>

  {#if !user}
    <p>Connecte-toi pour voir ton dashboard.</p>
  {:else}
    <section class="section">
      <h3>Ressources globales</h3>
      <ResourceBar />
    </section>

    {#if loading}
      <LoadingSpinner />
    {:else if myNodes.length === 0}
      <section class="section">
        <p class="alert">Attribution d'un node en cours...</p>
      </section>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <h3 class="stat-title">
            🏭 Vos Nodes ({myNodes.length})
          </h3>
          {#each myNodes as node}
            <div class="node-summary">
              <div>
                <div class="node-name">{node.name}</div>
                <div class="node-coords">({node.pos.x}, {node.pos.y})</div>
              </div>
              <div class="text-right">
                <div class="text-sm text-gray-400">Ressources stockées</div>
                <div class="text-xs">
                  💾 {node.resources.data} | ⚡ {node.resources.cpu} | 📡 {node.resources.bandwidth}
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="stat-card">
          <h3 class="stat-title">
            ⚡ Production par heure
          </h3>
          {#if myNodes[0]}
            <div class="production-summary">
              <div class="prod-item">
                <div class="prod-value">{getMineProduction(myNodes[0], 'mineData') * 3600}</div>
                <div class="prod-label">💾 Data/h</div>
              </div>
              <div class="prod-item">
                <div class="prod-value">{getMineProduction(myNodes[0], 'mineCPU') * 3600}</div>
                <div class="prod-label">⚡ CPU/h</div>
              </div>
              <div class="prod-item">
                <div class="prod-value">{getMineProduction(myNodes[0], 'mineBandwidth') * 3600}</div>
                <div class="prod-label">📡 Bandwidth/h</div>
              </div>
            </div>
          {/if}
        </div>

        <div class="stat-card">
          <h3 class="stat-title">
            🎯 Actions rapides
          </h3>
          <div class="flex flex-col gap-2">
            <a href="/constructions" class="btn-mini">🏗️ Gérer les constructions</a>
            <a href="/army" class="btn-mini">⚔️ Recruter des unités</a>
            <a href="/univers" class="btn-mini">🌌 Explorer l'univers</a>
            <a href="/tech" class="btn-mini">🔬 Rechercher des technologies</a>
          </div>
        </div>
      </div>
    {/if}

    {#if errorMsg}
      <section class="section">
        <div class="alert">{errorMsg}</div>
      </section>
    {/if}
  {/if}
</div>
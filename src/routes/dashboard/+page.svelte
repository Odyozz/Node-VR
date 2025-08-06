<script lang="ts">
  import { auth, db } from '$lib/firebase';
  import { assignRandomNodeToUser } from '$lib/assignNode';
  import { onMount, onDestroy } from 'svelte';
  import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
  import { goto } from '$app/navigation';
  import type { User } from "firebase/auth";
  import { resources } from '$lib/stores/resources';

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
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
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
</style>

<div class="dashboard">
  <h2>Tableau de bord</h2>

  {#if !user}
    <p>Connecte-toi pour voir ton dashboard.</p>
  {:else}
    <section class="section">
      <h3>Ressources globales</h3>
      <div class="resources">
        <div>💾 {$resources.data} Données</div>
        <div>⚡ {$resources.cpu} CPU</div>
        <div>📡 {$resources.bandwidth} Bande Passante</div>
      </div>
    </section>

    <section class="section">
      <h3>Tes Nodes</h3>
      {#if loading}
        <p>Chargement...</p>
      {:else if myNodes.length === 0}
        <p class="alert">Aucun node trouvé.</p>
      {:else}
        <ul class="nodes">
          {#each myNodes as node}
            <li>
              <div><b>{node.name}</b> — Position : ({node.pos.x}, {node.pos.y})</div>
              <div>
                💾 {node.resources.data} &nbsp; ⚡ {node.resources.cpu} &nbsp; 📡 {node.resources.bandwidth}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="section">
      <h3>Alertes</h3>
      <div class="alert">[À venir : alertes d’attaque, upgrades, alliance...]</div>
      {#if errorMsg}
        <div class="alert">{errorMsg}</div>
      {/if}
    </section>
  {/if}
</div>

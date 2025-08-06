<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth, db } from '$lib/firebase';
  import { doc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
  import type { Unsubscribe } from 'firebase/firestore';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { User } from 'firebase/auth';
  import { resources } from '$lib/stores/resources';
  import { maxResources } from '$lib/stores/maxResources';
  import { getMineProduction, getStorageMax, type NodeData } from '$lib/utils/nodeUtils';
  import { get } from 'svelte/store';

  let user: User | null = null;
  $: currentPath = $page.url.pathname;

  let unsubscribeResources: Unsubscribe | null = null;
  let unsubscribeNode: Unsubscribe | null = null;
  let unsubscribeAuth: Unsubscribe | null = null;

  let myNode: NodeData | null = null;
  let nodeId: string | null = null;
  let intervalId: ReturnType<typeof setInterval>;

  // Abonne-toi en temps réel au node du joueur
  async function subscribeNode(uid: string) {
    // Récupère le node du joueur
    const q = query(collection(db, 'nodes'), where('owner', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      myNode = null;
      nodeId = null;
      resources.set({ data: 0, cpu: 0, bandwidth: 0 });
      maxResources.set({ data: 0, cpu: 0, bandwidth: 0 });
      return;
    }
    const nodeDoc = snap.docs[0];
    nodeId = nodeDoc.id;

    // Unsubscribe previous
    if (unsubscribeNode) unsubscribeNode();

    // Ecoute le node en temps réel
    unsubscribeNode = onSnapshot(doc(db, 'nodes', nodeId), (docSnap) => {
      if (docSnap.exists()) {
        myNode = { id: docSnap.id, ...docSnap.data() } as NodeData;
        // Met à jour les ressources réelles du node
        const data = myNode.resources?.data || 0;
        const cpu = myNode.resources?.cpu || 0;
        const bandwidth = myNode.resources?.bandwidth || 0;
        resources.set({ data, cpu, bandwidth });

        // Met à jour les CAP dynamiquement
        const max = getStorageMax(myNode);
        maxResources.set({ data: max.data, cpu: max.cpu, bandwidth: max.bandwidth });
      } else {
        myNode = null;
        nodeId = null;
        resources.set({ data: 0, cpu: 0, bandwidth: 0 });
        maxResources.set({ data: 0, cpu: 0, bandwidth: 0 });
      }
    });
  }

  // Production auto chaque seconde
  async function produceResources() {
    if (!myNode || !user) return;
    const addData = getMineProduction(myNode, 'mineData');
    const addCpu = getMineProduction(myNode, 'mineCPU');
    const addBandwidth = getMineProduction(myNode, 'mineBandwidth');
    const max = getStorageMax(myNode);

    let localRes = get(resources);

    let newData = Math.min(localRes.data + addData, max.data);
    let newCpu = Math.min(localRes.cpu + addCpu, max.cpu);
    let newBandwidth = Math.min(localRes.bandwidth + addBandwidth, max.bandwidth);

    // Met à jour le store pour la navbar, partout
    resources.set({
      data: newData,
      cpu: newCpu,
      bandwidth: newBandwidth
    });

    // Envoie sur Firestore si changement
    try {
      const nodeRef = doc(db, 'nodes', myNode.id);
      await updateDoc(nodeRef, {
        'resources.data': newData,
        'resources.cpu': newCpu,
        'resources.bandwidth': newBandwidth,
      });
      // Mets à jour aussi le node local pour la prochaine tick
      myNode.resources.data = newData;
      myNode.resources.cpu = newCpu;
      myNode.resources.bandwidth = newBandwidth;
    } catch (err) {
      // On ignore l’erreur réseau, on ne bloque pas l’UI
    }
  }

  onMount(() => {
    unsubscribeAuth = auth.onAuthStateChanged(async (u: User | null) => {
      user = u;
      if (!user && currentPath !== '/login') {
        goto('/login');
        return;
      }

      // Abonne-toi au node du joueur
      if (user) {
        await subscribeNode(user.uid);
      } else {
        if (unsubscribeNode) unsubscribeNode();
      }
    });

    // Tick toutes les secondes la prod auto
    intervalId = setInterval(() => {
      produceResources();
    }, 1000);

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeResources) unsubscribeResources();
      if (unsubscribeNode) unsubscribeNode();
      clearInterval(intervalId);
    };
  });

  function logout() {
    auth.signOut();
    goto('/login');
  }
</script>

{#if currentPath !== '/login' && currentPath !== '/register'}
<nav>
  <ul>
    <li><a href="/dashboard" class:selected={currentPath === '/dashboard'}>Dashboard</a></li>
    <li><a href="/nodes" class:selected={currentPath === '/nodes'}>Nodes</a></li>
    <li><a href="/univers" class:selected={currentPath === '/univers'}>Univers</a></li>
    <li><a href="/army" class:selected={currentPath === '/army'}>Armée</a></li>
    <li><a href="/constructions" class:selected={currentPath === '/constructions'}>Constructions</a></li>
    <li><a href="/tech" class:selected={currentPath === '/tech'}>Technologie</a></li>
    <li><a href="/alliance" class:selected={currentPath === '/alliance'}>Alliance</a></li>
  </ul>

  <div class="spacer"></div>

{#if user}
  <div class="resources-nav">
    <div>💾 {$resources.data} / {$maxResources.data}</div>
    <div>⚡ {$resources.cpu} / {$maxResources.cpu}</div>
    <div>📡 {$resources.bandwidth} / {$maxResources.bandwidth}</div>
  </div>
  <button class="logout" on:click={logout}>Déconnexion</button>
{/if}
</nav>
{/if}

<slot />

<style>
  nav {
    background: rgba(24, 24, 36, 0.85);
    backdrop-filter: blur(12px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    padding: 0 2.5rem;
    height: 64px;
    font-family: 'Poppins', sans-serif;
  }
  ul {
    display: flex;
    gap: 1.8rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    position: relative;
  }
  a {
    color: #cfd2d6;
    font-weight: 500;
    font-size: 1rem;
    text-decoration: none;
    padding: 0.6rem 0;
    transition: color 0.3s ease;
  }
  a:hover, a.active {
    color: #5a7fa8;
  }
  a.active::after {
    content: "";
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #5a7fa8, #aabedc);
    border-radius: 2px;
  }
  .spacer {
    flex-grow: 1;
  }
  button.logout {
    background: transparent;
    border: 2px solid #c8b68e;
    color: #c8b68e;
    padding: 0.5rem 1.2rem;
    border-radius: 18px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease;
    font-family: 'Poppins', sans-serif;
  }
  button.logout:hover {
    background-color: #c8b68e;
    color: #121212;
  }
  .resources-nav {
    display: flex;
    gap: 1.2rem;
    font-weight: 600;
    font-size: 0.95rem;
    color: #cfd2d6;
    user-select: none;
    margin-right: 1rem;
  }
  .resources-nav div {
    background: rgba(90, 127, 168, 0.2);
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
  }
</style>

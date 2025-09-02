<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { db, auth } from '$lib/firebase';
  import { collection, query, onSnapshot, addDoc, serverTimestamp, where, orderBy, type Unsubscribe } from 'firebase/firestore';
  import type { User } from 'firebase/auth';
  import { get, writable } from 'svelte/store';
  import { selectedNode } from '$lib/stores/selectedNode';
  import { armyUnits } from '$lib/utils/units';
  import { getBuildingLevel } from '$lib/utils/nodeUtils';

  // ==== État général
  let user: User | null = null;
  let allNodes: any[] = [];
  let allMines: any[] = [];
  let myNode: any = null;
  let loading = true;

  // ==== Carte & navigation
  let center = { x: 100, y: 100 };
  let zoom = 1;
  let dragging = false;
  let last = { x: 0, y: 0 };

  // ==== Tooltips
  let showTooltip = false;
  let tooltipContent = '';
  let tooltipX = 0;
  let tooltipY = 0;

  // ==== Panneau d’envoi
  let showSendArmyPanel = false;
  let sendTarget: any = null;
  let sendError = writable('');
  let sendInProgress = writable(false);
  let armySelection = writable<{ [key: string]: number }>({});
  let maxTotalToSend = 1000;
  let selectedUnitsKeys: string[] = [];

  // ==== Ordres d’armée en cours
  let armyOrders: any[] = [];
  let unsubOrders: Unsubscribe | null = null;

  // ==== Gère les nodes et mines
  let unsubNodes: Unsubscribe | null = null;
  let unsubMines: Unsubscribe | null = null;
  let unsubAuth: any = null;

  // ==== Sélection dynamique de l’armée à envoyer
  $: {
    if (myNode?.army?.units) {
      selectedUnitsKeys = Object.keys(myNode.army.units).filter(key => myNode.army.units[key] > 0);
      let obj: { [key: string]: number } = {};
      selectedUnitsKeys.forEach(key => obj[key] = 0);
      armySelection.set(obj);
    }
  }

  // ==== Limite max envoi (centre de commandement)
  function getCommandCenterLimit(node: any): number {
    if (!node?.constructions?.commandCenter) return 1000;
    return 1000 + (node.constructions.commandCenter - 1) * 500;
  }

  // ==== Ouvre panneau envoi
  function openSendArmyPanel(target: any) {
    sendTarget = target;
    showSendArmyPanel = true;
    sendError.set('');
    if (myNode?.army?.units) {
      maxTotalToSend = getCommandCenterLimit(myNode);
      let obj: { [key: string]: number } = {};
      Object.keys(myNode.army.units).forEach(key => obj[key] = 0);
      armySelection.set(obj);
    }
  }

  function closeSendArmyPanel() {
    showSendArmyPanel = false;
    sendTarget = null;
    sendError.set('');
  }

  // ==== Calcul du temps de trajet
  function getArmyTravelInfo(selection: { [key: string]: number }) {
    if (!sendTarget || !myNode?.pos) return { speed: 1, duration: 0, distance: 0, display: "0s" };
    let slowest = 9999;
    for (const [unitKey, qty] of Object.entries(selection)) {
      if (qty > 0) {
        const unit = armyUnits.find(u => u.key === unitKey);
        if (unit && unit.speed && unit.speed < slowest) slowest = unit.speed;
      }
    }
    if (slowest === 9999) slowest = 1;
    const dx = Math.abs((myNode.pos?.x ?? 0) - (sendTarget.pos?.x ?? 0));
    const dy = Math.abs((myNode.pos?.y ?? 0) - (sendTarget.pos?.y ?? 0));
    const distance = Math.sqrt(dx*dx + dy*dy);
    const seconds = Math.round(distance * 30 / slowest);
    return {
      speed: slowest,
      distance,
      duration: seconds,
      display: formatSeconds(seconds),
    };
  }

  function formatSeconds(s: number) {
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  // ==== Validation de l’envoi
  function canSendArmy($armySelection: {[key:string]:number}): boolean {
    if (!myNode?.army?.units) return false;
    const total = Object.entries($armySelection).reduce((sum, [unit, qty]) => sum + (qty || 0), 0);
    if (total === 0) return false;
    if (total > maxTotalToSend) return false;
    for (const [unit, qty] of Object.entries($armySelection)) {
      if (qty > (myNode.army.units[unit] || 0)) return false;
      if (qty < 0) return false;
    }
    return true;
  }

  // ==== ENVOI D’UNE ARMÉE (création Firestore, adaptation node libre/contest)
  async function sendArmy() {
    sendInProgress.set(true);
    sendError.set('');
    const $armySelection = get(armySelection);

    if (!canSendArmy($armySelection)) {
      sendError.set("Sélection d'armée invalide ou limite dépassée.");
      sendInProgress.set(false);
      return;
    }

    // === Préparation logique “node libre”
    let isNodeLibre = !sendTarget.owner && !sendTarget.capturedBy;
    let minUnitsForCapture = 10;   // À paramétrer à ta guise
    let resourceCost = { cpu: 100, data: 100, bandwidth: 100 }; // À paramétrer
    let hasEnoughUnits = Object.values($armySelection).reduce((sum, v) => sum + v, 0) >= minUnitsForCapture;
    let hasEnoughRes = myNode?.resources
      && myNode.resources.cpu >= resourceCost.cpu
      && myNode.resources.data >= resourceCost.data
      && myNode.resources.bandwidth >= resourceCost.bandwidth;

    if (isNodeLibre) {
      if (!hasEnoughUnits) {
        sendError.set(`Il faut au moins ${minUnitsForCapture} unités pour capturer un node libre.`);
        sendInProgress.set(false);
        return;
      }
      if (!hasEnoughRes) {
        sendError.set(`Pas assez de ressources pour capturer ce node libre.`);
        sendInProgress.set(false);
        return;
      }
    }

    // --- Décrémente l’armée locale tout de suite (UX)
    let updatedArmy = { ...myNode.army, units: { ...myNode.army.units } };
    for (const [unit, qty] of Object.entries($armySelection)) {
      updatedArmy.units[unit] = (updatedArmy.units[unit] || 0) - qty;
      if (updatedArmy.units[unit] < 0) updatedArmy.units[unit] = 0;
    }

    // --- Préparation infos pour Firestore
    const { duration } = getArmyTravelInfo($armySelection);
    const arrivesAt = Date.now() + duration * 1000;
    try {
      await addDoc(collection(db, 'armyOrders'), {
        fromNodeId: myNode.id,
        fromNodePos: myNode.pos,
        toType: sendTarget.type || "node",
        toId: sendTarget.id,
        toPos: sendTarget.pos,
        playerId: user?.uid,
        units: $armySelection,
        sentAt: serverTimestamp(),
        arrivesAt,
        duration,
        status: "enCours",
        // --- Infos spécifiques pour node libre (capturable)
        isNodeLibre,
        minUnitsForCapture,
        resourceCost: isNodeLibre ? resourceCost : null
      });

      // --- Décrémente visuellement armée et res
      myNode = { ...myNode, army: { ...updatedArmy } };
      if (isNodeLibre) {
        myNode = {
          ...myNode,
          resources: {
            ...myNode.resources,
            cpu: myNode.resources.cpu - resourceCost.cpu,
            data: myNode.resources.data - resourceCost.data,
            bandwidth: myNode.resources.bandwidth - resourceCost.bandwidth
          }
        };
      }
      selectedNode.set(myNode);

      sendError.set('');
      sendInProgress.set(false);
      closeSendArmyPanel();
    } catch (e) {
      sendError.set("Erreur lors de l'envoi de l'armée.");
      sendInProgress.set(false);
    }
  }

  // ==== Affichage ordres en attente pour ton node
  function listenArmyOrders() {
    if (unsubOrders) unsubOrders();
    if (!user || !myNode) return;
    const q = query(
      collection(db, 'armyOrders'),
      where('fromNodeId', '==', myNode.id),
      orderBy('arrivesAt', 'asc')
    );
    unsubOrders = onSnapshot(q, (snap) => {
      armyOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
  }

  // ==== Map / Navigation / Pan/Zoom
  function preventSelect(e: Event) { e.preventDefault(); return false; }
  function refreshMyNode() { myNode = allNodes.find(n => n.owner === user?.uid); }
  function centerOnMine() { if (myNode?.pos) { center.x = myNode.pos.x; center.y = myNode.pos.y; } }
  function onNodeClick(node: any, e?: MouseEvent) {
    selectedNode.set(node);
    showTooltip = true;
    tooltipContent = `
      <b>${node.name}</b><br/>
      Coord: (${node.pos.x},${node.pos.y})<br/>
      ${node.owner === user?.uid ? "Ton node principal" : node.owner ? "Appartient à un joueur" : "Node libre"}
    `;
    if (e) { tooltipX = e.clientX; tooltipY = e.clientY; }
    if (node.owner !== user?.uid) { openSendArmyPanel(node); }
  }
  function showTooltipForNode(node: any, e: MouseEvent) {
    showTooltip = true;
    tooltipContent = `
      <b>${node.name}</b><br/>
      Coord: (${node.pos.x},${node.pos.y})<br/>
      ${node.owner === user?.uid ? "Ton node principal" : node.owner ? "Appartient à un joueur" : "Node libre"}
    `;
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }
  function getMineExpiration(mine: any) {
    if (!mine.expiresAt || !mine.expiresAt.toDate) return "";
    const msLeft = mine.expiresAt.toDate().getTime() - Date.now();
    if (msLeft <= 0) return "Expirée";
    const min = Math.floor(msLeft / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0
      ? `Expire dans ${h}h${m > 0 ? " "+m+"m" : ""}`
      : `Expire dans ${m} min`;
  }
  function onMineHover(mine: any, e: MouseEvent) {
    showTooltip = true;
    tooltipContent = `
      <b>⛏️ Mine de ${mine.type?.toUpperCase()}</b><br/>
      Pos: (${mine.pos.x},${mine.pos.y})<br/>
      ${mine.capturedBy ? `<span style='color:#aaf'>Capturée</span>` : `<span style='color:#ffe'>Libre</span>`}
      <br><small>${getMineExpiration(mine)}</small>
    `;
    tooltipX = e.clientX;
    tooltipY = e.clientY;
  }
  function onMineClick(mine: any, e?: MouseEvent) { openSendArmyPanel(mine); showTooltip = false; }
  function startPan(e: MouseEvent) { if (e.button !== 0) return; dragging = true; last.x = e.clientX; last.y = e.clientY; document.body.style.userSelect = "none"; window.addEventListener('selectstart', preventSelect); }
  function pan(e: MouseEvent) {
    if (!dragging) return;
    e.preventDefault();
    const dx = (e.clientX - last.x) / (44 * zoom);
    const dy = (e.clientY - last.y) / (44 * zoom);
    center.x -= dx;
    center.y -= dy;
    last.x = e.clientX;
    last.y = e.clientY;
    showTooltip = false;
  }
  function endPan() { dragging = false; document.body.style.userSelect = ""; window.removeEventListener('selectstart', preventSelect); }
  function handleWheel(e: WheelEvent) { e.preventDefault(); if (e.deltaY < 0 && zoom < 3) zoom *= 1.1; if (e.deltaY > 0 && zoom > 0.25) zoom /= 1.1; showTooltip = false; }
  function closeTooltip() { showTooltip = false; }
  let gotoX = '', gotoY = '';
  function goToCoord() { const x = parseInt(gotoX); const y = parseInt(gotoY); if (!isNaN(x) && !isNaN(y)) { center.x = x; center.y = y; } }
  function onKeydown(e: KeyboardEvent) {
    if (["ArrowLeft","a"].includes(e.key)) center.x -= 1;
    if (["ArrowRight","d"].includes(e.key)) center.x += 1;
    if (["ArrowUp","w"].includes(e.key)) center.y -= 1;
    if (["ArrowDown","s"].includes(e.key)) center.y += 1;
  }

  // ==== Initialisation
  onMount(() => {
    unsubAuth = auth.onAuthStateChanged((u) => {
      user = u;
      if (unsubNodes) unsubNodes();
      if (unsubMines) unsubMines();
      if (!user) return;
      loading = true;
      const q = query(collection(db, 'nodes'));
      unsubNodes = onSnapshot(q, (snap) => {
        allNodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        myNode = allNodes.find(n => n.owner === user?.uid);
        loading = false;
        listenArmyOrders();
      });
      const minesQ = query(collection(db, 'mines'));
      unsubMines = onSnapshot(minesQ, (snap) => {
        allMines = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    });
    window.addEventListener('keydown', onKeydown);
  });
  onDestroy(() => {
    if (unsubNodes) unsubNodes();
    if (unsubMines) unsubMines();
    if (unsubOrders) unsubOrders();
    if (unsubAuth) unsubAuth();
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('selectstart', preventSelect);
    document.body.style.userSelect = "";
  });

</script>

<style>
.svg-map {
  background: #141923;
  border: 1px solid #222;
  margin-top: 1rem;
  width: 100vw;
  max-width: 1000px;
  height: 65vh;
  min-height: 380px;
  max-height: 700px;
  display: block;
  border-radius: 0.75rem;
  box-shadow: 0 0 18px #0008;
  cursor: grab;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}
.svg-map:active { cursor: grabbing; }
svg text {
  user-select: none;
  pointer-events: none;
}
.star { fill: #fff2; }
.legend-dot { font-size: 1.8em; vertical-align: middle; margin-right: 7px; }
.legend { margin-top: 1rem; font-size: 1.1em; }
.tooltip-univ {
  position: fixed;
  background: #232a3ccf;
  color: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 10px #000a;
  padding: 14px 18px 13px 18px;
  z-index: 99;
  pointer-events: none;
  font-size: 1.1em;
  min-width: 120px;
  border: 1.5px solid #00bfa5;
  max-width: 280px;
  text-align: left;
}
.btn-toolbar {
  margin: 8px 0 14px 0;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.btn-mini {
  background: #1f3545;
  color: #e9f9fa;
  font-weight: bold;
  border: 1px solid #3ce3ff99;
  border-radius: 8px;
  padding: 7px 15px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.13s, border 0.16s;
  user-select: none;
}
.btn-mini:hover { background: #2ad5c4; color: #fff; border: 1px solid #fff;}
@media (max-width: 1020px) {
  .svg-map { width: 96vw; height: 56vw; min-height: 280px;}
}
@media (max-width: 700px) {
  .svg-map { width: 99vw; height: 60vw; min-height: 180px;}
}

/* Side-panel */
.send-army-panel {
  position: fixed;
  top: 0; right: 0;
  width: 390px; max-width: 97vw;
  height: 100vh;
  background: #202b40ec;
  z-index: 99;
  box-shadow: -4px 0 22px #000a;
  padding: 38px 24px 18px 26px;
  overflow-y: auto;
  transition: all 0.24s cubic-bezier(.4,2.2,.5,1);
  border-left: 2px solid #1ec0a7cc;
  backdrop-filter: blur(4px);
}
@media (max-width: 650px) {
  .send-army-panel { width: 98vw; padding: 17vw 2vw 2vw 4vw; }
}
.close-panel-btn {
  float: right;
  font-size: 1.5em;
  color: #aaf;
  background: none;
  border: none;
  cursor: pointer;
  margin-top: -20px;
  margin-right: -9px;
}
.send-error {
  color: #ff7878;
  background: #381c2c;
  border-radius: 8px;
  margin: 12px 0;
  padding: 8px 12px;
  font-size: 1em;
}
.army-slider-row {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 3px;
}
.army-slider-row input[type="number"] {
  width: 44px;
  text-align: center;
  font-weight: bold;
  font-size: 1em;
  background: #171b22;
  border: 1.5px solid #28e0d088;
  border-radius: 5px;
  color: #49fae2;
  padding: 3px;
}
.army-slider-row button {
  width: 27px;
  font-size: 1em;
  background: #2b364b;
  color: #aaffee;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.army-slider-row button:disabled { opacity: 0.38; cursor: not-allowed;}

/* Army orders (liste droite) */
.army-orders-panel {
  position: fixed;
  bottom: 0; right: 0;
  width: 390px; max-width: 97vw;
  background: #202b40ec;
  z-index: 80;
  box-shadow: -4px 0 22px #000a;
  padding: 14px 24px 22px 26px;
  border-left: 2px solid #1ec0a7cc;
  border-top: 2px solid #1ec0a7cc;
  backdrop-filter: blur(4px);
  border-bottom-left-radius: 18px;
}
@media (max-width: 650px) {
  .army-orders-panel { width: 98vw; padding: 5vw 2vw 5vw 4vw; }
}
</style>


<h2 class="text-2xl font-bold mb-4">Carte de l'Univers</h2>

{#if loading}
  <p>Chargement…</p>
{:else}
  <div aria-label="Carte de l'univers" style="max-width:1050px;margin:auto;user-select:none;">
    <div class="btn-toolbar">
      <span>
        <b>Pos :</b> ({Math.round(center.x)}, {Math.round(center.y)})
        {#if myNode} | <b>Ton Node :</b> <span style="color:#34d399">({myNode.pos.x},{myNode.pos.y})</span> {/if}
      </span>
      <button class="btn-mini" on:click={centerOnMine} title="Centrer sur mon node">🧭 Mon Node</button>
      <button class="btn-mini" on:click={() => {zoom = Math.min(zoom * 1.2, 3)}} title="Zoom avant">+</button>
      <button class="btn-mini" on:click={() => {zoom = Math.max(zoom / 1.2, 0.25)}} title="Zoom arrière">-</button>
      <input placeholder="X" bind:value={gotoX} size="3" class="btn-mini" style="width:3.5em" />
      <input placeholder="Y" bind:value={gotoY} size="3" class="btn-mini" style="width:3.5em" />
      <button class="btn-mini" on:click={goToCoord}>Aller à</button>
    </div>
    <svg
      class="svg-map"
      viewBox="0 0 1000 700"
      tabindex="-1"
      on:mousedown={startPan}
      on:mousemove={pan}
      on:mouseup={endPan}
      on:mouseleave={endPan}
      on:wheel={handleWheel}
      aria-label="Carte interactive"
    >
      <!-- étoiles décoratives -->
      {#each Array(90) as _,i}
        <circle class="star" cx={Math.random()*1000} cy={Math.random()*700} r={Math.random()*0.8+0.3} />
      {/each}
      <!-- grille -->
      {#each Array(25) as _, xi}
        <line x1={xi*40} y1={0} x2={xi*40} y2={700} stroke="#222" stroke-width="0.6"/>
      {/each}
      {#each Array(18) as _, yi}
        <line x1={0} y1={yi*40} x2={1000} y2={yi*40} stroke="#222" stroke-width="0.6"/>
      {/each}
      <!-- MINES (affichées SOUS les nodes) -->
      {#each allMines as mine (mine.id)}
        <g>
          <circle
            cx={500 + (mine.pos.x - center.x)*40*zoom}
            cy={350 + (mine.pos.y - center.y)*40*zoom}
            r="13"
            fill="none"
            stroke={mine.type === 'data' ? "#60a5fa" : mine.type === 'cpu' ? "#f472b6" : "#fbbf24"}
            stroke-width="4"
            stroke-dasharray="4 5"
            style="opacity:0.88;filter:drop-shadow(0 0 5px #222)"
            pointer-events="none"
          />
          <circle
            cx={500 + (mine.pos.x - center.x)*40*zoom}
            cy={350 + (mine.pos.y - center.y)*40*zoom}
            r="8"
            fill={mine.type === 'data' ? "#2563eb" : mine.type === 'cpu' ? "#db2777" : "#eab308"}
            stroke="#fff"
            stroke-width="2"
            on:mouseover={(e) => onMineHover(mine, e)}
            on:mouseleave={closeTooltip}
            on:click={(e) => onMineClick(mine, e)}
            style="cursor:pointer;"
            aria-label="Mine"
            role="button"
          />
        </g>
      {/each}
      <!-- NODES -->
      {#each allNodes as node (node.id)}
        {#if node.pos}
          {#if node.owner === user?.uid}
            <circle
              cx={500 + (node.pos.x - center.x)*40*zoom}
              cy={350 + (node.pos.y - center.y)*40*zoom}
              r="19"
              fill="none"
              stroke="#00f8b7cc"
              stroke-width="5"
              style="filter: blur(1.2px); opacity:0.45"
              pointer-events="none"
            />
          {/if}
          <circle
            tabindex="-1"
            cx={500 + (node.pos.x - center.x)*40*zoom}
            cy={350 + (node.pos.y - center.y)*40*zoom}
            r={node.owner === user?.uid ? 13 : node.owner ? 10 : 7}
            fill={node.owner === user?.uid ? "#34d399" : node.owner ? "#f59e42" : "#fff"}
            stroke="#000" stroke-width="2"
            on:click={(e) => onNodeClick(node, e)}
            on:mouseover={(e) => showTooltipForNode(node, e)}
            on:mouseleave={closeTooltip}
            aria-label={"Node " + node.name}
            role="button"
            style="outline: none;"
          />
          <text
            x={500 + (node.pos.x - center.x)*40*zoom + (node.owner ? 17 : 13)}
            y={350 + (node.pos.y - center.y)*40*zoom + 6}
            font-size="13"
            fill="#fff"
            style="text-shadow:0 0 5px #111; pointer-events: none;"
          >{node.name}</text>
        {/if}
      {/each}
    </svg>
    {#if showTooltip}
      <div class="tooltip-univ" style="left:{tooltipX+18}px;top:{tooltipY-30}px" on:mouseleave={closeTooltip}>
        {@html tooltipContent}
      </div>
    {/if}
    <div class="legend">
      <span class="legend-dot" style="color:#34d399">●</span> Ton node&nbsp;&nbsp;
      <span class="legend-dot" style="color:#f59e42">●</span> Node d'un autre&nbsp;&nbsp;
      <span class="legend-dot" style="color:#fff; text-shadow:0 0 3px #222">●</span> Node libre&nbsp;&nbsp;
      <span class="legend-dot" style="color:#60a5fa">●</span> Mine DATA&nbsp;
      <span class="legend-dot" style="color:#f472b6">●</span> Mine CPU&nbsp;
      <span class="legend-dot" style="color:#fbbf24">●</span> Mine BANDWIDTH&nbsp;
      &nbsp;&nbsp;&nbsp;<span style="font-size:0.9em; color:#b1e7ff">(Zoom: molette ou +/- ; Déplacement: drag &amp; flèches/WASD)</span>
    </div>
  </div>
{/if}

<!-- === SIDE PANEL ENVOI ARMEE === -->
{#if showSendArmyPanel && sendTarget}
  <div class="send-army-panel">
    <button class="close-panel-btn" on:click={closeSendArmyPanel}>×</button>
    <h3 style="font-size:1.23em;margin-bottom:8px;">Envoyer une armée</h3>
    <div style="margin-bottom:13px;">
      <b>Cible :</b> <span style="color:#60a5fa">{sendTarget.name || sendTarget.type?.toUpperCase() || "?"}</span>
      <br>
      {#if sendTarget.owner}
        <span style="color:#f59e42;">Node ennemi</span>
      {:else if sendTarget.capturedBy}
        <span style="color:#aaf;">Mine capturée</span>
      {:else}
        <span style="color:#fff;">Libre</span>
      {/if}
      <br>
      <span>Coord: ({sendTarget.pos.x},{sendTarget.pos.y})</span>
    </div>
    <h4 style="margin:14px 0 10px 0;">Ton armée disponible :</h4>
<div>
  {#each selectedUnitsKeys as unitKey}
    {#if myNode.army?.units?.[unitKey] > 0}
      <div class="army-slider-row" style="margin-bottom:10px;">
        <span style="flex:1;font-weight:600;color:#f8fafc;">
          {armyUnits.find(u => u.key === unitKey)?.name}
        </span>
        <button
          on:click={() => armySelection.update(sel => ({...sel, [unitKey]: Math.max((sel[unitKey]||0)-1,0)}))}
          disabled={$armySelection[unitKey]<=0}
        >-</button>
        <input
          type="number" min="0" max={myNode.army.units[unitKey]}
          bind:value={$armySelection[unitKey]}
          on:input={e => {
            const input = e.target as HTMLInputElement;
            let val = parseInt(input.value) || 0;
            val = Math.max(0, Math.min(val, myNode.army.units[unitKey]));
            armySelection.update(sel => ({...sel, [unitKey]: val}));
          }}
          style="width:50px;text-align:center;font-weight:bold;font-size:1em;"
        />
        <button
          on:click={() => armySelection.update(sel => ({...sel, [unitKey]: Math.min((sel[unitKey]||0)+1, myNode.army.units[unitKey])}))}
          disabled={$armySelection[unitKey]>=myNode.army.units[unitKey]}
        >+</button>
        <span style="color:#34d399;margin-left:10px;">/ {myNode.army.units[unitKey]}</span>
      </div>
      <div style="color:#aaa;font-size:0.98em;margin-bottom:7px;margin-left:5px;">
        <b>Attaque:</b> {armyUnits.find(u => u.key === unitKey)?.attack || 0}
        | <b>Défense:</b> {armyUnits.find(u => u.key === unitKey)?.defense || 0}
        | <b>Vitesse:</b> {armyUnits.find(u => u.key === unitKey)?.speed || 0}
      </div>
      <div style="color:#b5f1ff;font-size:0.93em;margin-left:5px;">
        {armyUnits.find(u => u.key === unitKey)?.description}
      </div>
      <hr style="border:0;border-top:1px solid #22313d;margin:9px 0 9px 0;">
    {/if}
  {/each}
</div>



    <div style="margin-top:15px;">
      <b>Limite max total :</b> {maxTotalToSend}
    </div>
    <div style="margin-top:2px;">
      <b>Total sélectionné :</b> {Object.values($armySelection).reduce((a,b)=>a+b,0)}
    </div>
    <div style="margin-top:9px;">
      <b>Vitesse (la plus lente) :</b>
      {getArmyTravelInfo($armySelection).speed} cases/tick
      <br />
      <b>Distance :</b> {getArmyTravelInfo($armySelection).distance.toFixed(2)} cases
      <br />
      <b>Temps de trajet :</b> {getArmyTravelInfo($armySelection).display}
    </div>
    {#if $sendError}
      <div class="send-error">{$sendError}</div>
    {/if}
    <button
      class="btn-mini"
      style="margin-top:22px;width:100%;"
      on:click={sendArmy}
      disabled={!canSendArmy($armySelection) || $sendInProgress}
    >
      {#if $sendInProgress}
        ⏳ Envoi...
      {:else}
        🚀 Envoyer l’armée
      {/if}
    </button>
  </div>
{/if}

<!-- LISTE DES ORDRES EN ATTENTE -->
{#if armyOrders.length > 0}
  <div class="army-orders-panel">
    <h3 style="font-size:1.17em;margin:12px 0 14px 0;color:#f8fafc;font-weight:bold;">Ordres d’armées en cours</h3>
    <ul style="list-style:none;padding:0;">
      {#each armyOrders as order}
        <li style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #233;">
          <span style="color:#fff;">
            Vers <b style="color:#60a5fa">{order.toType === "mine" ? "mine" : "node"}</b>
            ({order.toPos.x},{order.toPos.y})
          </span>
          <br />
          <span style="color:#b2e6ff;font-size:0.98em;">
            {Object.entries(order.units).map(([k,v]) =>
              `${armyUnits.find(u => u.key === k)?.name || k} x${v}`
            ).join(", ")}
          </span>
          <br />
          <span style="color:#5eead4">
            Arrivée dans : {formatSeconds(Math.max(0, Math.ceil((order.arrivesAt - Date.now())/1000)))}
          </span>
          {#if order.status && order.status !== "enCours"}
            <span style="margin-left:14px;color:#f59e42;">({order.status})</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

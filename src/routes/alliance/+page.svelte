<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, db } from '$lib/firebase';
  import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
  import type { User } from 'firebase/auth';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import { addNotification } from '$lib/stores/notifications';

  let user: User | null = null;
  let loading = true;
  let myAlliance: any = null;
  let alliances: any[] = [];
  let invitations: any[] = [];
  
  let showCreateForm = false;
  let newAllianceName = '';
  let newAllianceDescription = '';
  let createError = '';

  async function loadAllianceData() {
    if (!user) return;
    
    try {
      // Charger mon alliance
      const myAllianceQuery = query(
        collection(db, 'alliances'),
        where('members', 'array-contains', user.uid)
      );
      const myAllianceSnap = await getDocs(myAllianceQuery);
      myAlliance = myAllianceSnap.empty ? null : { id: myAllianceSnap.docs[0].id, ...myAllianceSnap.docs[0].data() };

      // Charger toutes les alliances publiques
      const alliancesQuery = query(collection(db, 'alliances'));
      const alliancesSnap = await getDocs(alliancesQuery);
      alliances = alliancesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Charger mes invitations
      const invitationsQuery = query(
        collection(db, 'allianceInvitations'),
        where('invitedUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const invitationsSnap = await getDocs(invitationsQuery);
      invitations = invitationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      addNotification('error', 'Erreur', 'Impossible de charger les données d\'alliance');
    }
    
    loading = false;
  }

  async function createAlliance() {
    if (!user || !newAllianceName.trim()) {
      createError = 'Le nom de l\'alliance est requis';
      return;
    }

    try {
      await addDoc(collection(db, 'alliances'), {
        name: newAllianceName.trim(),
        description: newAllianceDescription.trim(),
        leader: user.uid,
        members: [user.uid],
        createdAt: new Date(),
        isPublic: true
      });
      
      addNotification('success', 'Alliance créée', `L'alliance "${newAllianceName}" a été créée avec succès !`);
      showCreateForm = false;
      newAllianceName = '';
      newAllianceDescription = '';
      createError = '';
      await loadAllianceData();
    } catch (e) {
      createError = 'Erreur lors de la création de l\'alliance';
      addNotification('error', 'Erreur', createError);
    }
  }

  async function joinAlliance(allianceId: string) {
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'allianceInvitations'), {
        allianceId,
        invitedUserId: user.uid,
        invitedBy: 'self-request',
        status: 'pending',
        createdAt: new Date()
      });
      
      addNotification('info', 'Demande envoyée', 'Votre demande d\'adhésion a été envoyée');
    } catch (e) {
      addNotification('error', 'Erreur', 'Impossible d\'envoyer la demande');
    }
  }

  async function respondToInvitation(invitationId: string, accept: boolean) {
    if (!user) return;
    
    try {
      const invitationRef = doc(db, 'allianceInvitations', invitationId);
      await updateDoc(invitationRef, {
        status: accept ? 'accepted' : 'declined',
        respondedAt: new Date()
      });
      
      if (accept) {
        const invitation = invitations.find(inv => inv.id === invitationId);
        if (invitation) {
          const allianceRef = doc(db, 'alliances', invitation.allianceId);
          // Note: En production, il faudrait utiliser une transaction ou Cloud Function
          // pour éviter les conditions de course
        }
      }
      
      addNotification(
        accept ? 'success' : 'info',
        accept ? 'Invitation acceptée' : 'Invitation refusée',
        accept ? 'Vous avez rejoint l\'alliance !' : 'Invitation refusée'
      );
      
      await loadAllianceData();
    } catch (e) {
      addNotification('error', 'Erreur', 'Impossible de répondre à l\'invitation');
    }
  }

  onMount(() => {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      if (!user) {
        goto('/');
        return;
      }
      await loadAllianceData();
    });
  });
</script>

<style>
  .alliance-card {
    background: rgba(30, 30, 47, 0.75);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid rgba(90, 127, 168, 0.3);
  }
  .alliance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .alliance-name {
    font-size: 1.3rem;
    font-weight: 700;
    color: #aabedc;
  }
  .member-count {
    background: #5a7fa8;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .create-form {
    background: rgba(30, 30, 47, 0.75);
    border-radius: 12px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  .form-group {
    margin-bottom: 1rem;
  }
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #aabedc;
    font-weight: 600;
  }
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #374151;
    background: #1f2937;
    color: #fff;
    font-size: 1rem;
  }
  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }
  .btn-primary {
    background: #5a7fa8;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  .btn-primary:hover {
    background: #4a6b8a;
  }
  .btn-secondary {
    background: transparent;
    color: #9ca3af;
    padding: 0.75rem 1.5rem;
    border: 1px solid #374151;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .btn-secondary:hover {
    background: #374151;
    color: #fff;
  }
  .invitation-card {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }
  .invitation-actions {
    display: flex;
    gap: 8px;
    margin-top: 0.5rem;
  }
  .btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
  }
  .btn-accept {
    background: #10b981;
    color: white;
  }
  .btn-decline {
    background: #ef4444;
    color: white;
  }
</style>

<main class="max-w-6xl mx-auto p-6">
  <h1 class="text-4xl font-extrabold mb-6 text-center text-white">Alliances</h1>

  {#if loading}
    <LoadingSpinner />
  {:else if !user}
    <p class="text-center text-white">Connectez-vous pour gérer vos alliances.</p>
  {:else}
    
    {#if invitations.length > 0}
      <section class="section mb-6">
        <h2 class="text-xl font-bold mb-4 text-yellow-400">📨 Invitations en attente</h2>
        {#each invitations as invitation}
          <div class="invitation-card">
            <div class="font-semibold">Invitation à rejoindre une alliance</div>
            <div class="text-sm text-gray-400 mt-1">
              Reçue le {new Date(invitation.createdAt.toDate()).toLocaleDateString()}
            </div>
            <div class="invitation-actions">
              <button 
                class="btn-small btn-accept"
                on:click={() => respondToInvitation(invitation.id, true)}
              >
                Accepter
              </button>
              <button 
                class="btn-small btn-decline"
                on:click={() => respondToInvitation(invitation.id, false)}
              >
                Refuser
              </button>
            </div>
          </div>
        {/each}
      </section>
    {/if}

    {#if myAlliance}
      <section class="section">
        <h2 class="text-2xl font-bold mb-4 text-green-400">🛡️ Mon Alliance</h2>
        <div class="alliance-card">
          <div class="alliance-header">
            <div class="alliance-name">{myAlliance.name}</div>
            <div class="member-count">{myAlliance.members?.length || 0} membres</div>
          </div>
          {#if myAlliance.description}
            <p class="text-gray-300 mb-4">{myAlliance.description}</p>
          {/if}
          <div class="text-sm text-gray-400">
            Créée le {new Date(myAlliance.createdAt.toDate()).toLocaleDateString()}
          </div>
          {#if myAlliance.leader === user.uid}
            <div class="mt-4">
              <span class="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                👑 Leader
              </span>
            </div>
          {/if}
        </div>
      </section>
    {:else}
      <section class="section">
        <h2 class="text-2xl font-bold mb-4 text-blue-400">🤝 Rejoindre ou Créer une Alliance</h2>
        
        <div class="mb-6">
          <button 
            class="btn-primary"
            on:click={() => showCreateForm = !showCreateForm}
          >
            {showCreateForm ? 'Annuler' : '➕ Créer une nouvelle alliance'}
          </button>
        </div>

        {#if showCreateForm}
          <div class="create-form">
            <h3 class="text-xl font-semibold mb-4">Créer une Alliance</h3>
            
            {#if createError}
              <div class="bg-red-600 text-white p-3 rounded-lg mb-4">{createError}</div>
            {/if}
            
            <div class="form-group">
              <label for="alliance-name">Nom de l'alliance</label>
              <input 
                id="alliance-name"
                type="text" 
                bind:value={newAllianceName}
                placeholder="Nom de votre alliance"
                maxlength="50"
              />
            </div>
            
            <div class="form-group">
              <label for="alliance-desc">Description (optionnelle)</label>
              <textarea 
                id="alliance-desc"
                bind:value={newAllianceDescription}
                placeholder="Décrivez votre alliance..."
                maxlength="500"
              ></textarea>
            </div>
            
            <div class="flex gap-3">
              <button class="btn-primary" on:click={createAlliance}>
                Créer l'Alliance
              </button>
              <button class="btn-secondary" on:click={() => showCreateForm = false}>
                Annuler
              </button>
            </div>
          </div>
        {/if}

        <h3 class="text-xl font-semibold mb-4 mt-6">Alliances Disponibles</h3>
        {#if alliances.length === 0}
          <p class="text-gray-400">Aucune alliance disponible pour le moment.</p>
        {:else}
          <div class="grid gap-4">
            {#each alliances.filter(a => !a.members?.includes(user?.uid)) as alliance}
              <div class="alliance-card">
                <div class="alliance-header">
                  <div class="alliance-name">{alliance.name}</div>
                  <div class="member-count">{alliance.members?.length || 0} membres</div>
                </div>
                {#if alliance.description}
                  <p class="text-gray-300 mb-3">{alliance.description}</p>
                {/if}
                <div class="flex justify-between items-center">
                  <div class="text-sm text-gray-400">
                    Créée le {new Date(alliance.createdAt.toDate()).toLocaleDateString()}
                  </div>
                  <button 
                    class="btn-primary"
                    on:click={() => joinAlliance(alliance.id)}
                  >
                    Demander à rejoindre
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</main>
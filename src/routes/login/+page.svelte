<script lang="ts">
  import { auth } from '$lib/firebase';
  import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
  import { goto } from '$app/navigation';

  let tab: 'email' | 'google' = 'email';

  let email = '';
  let password = '';
  let errorMsg = '';
  let loading = false;

  async function loginEmail() {
    errorMsg = '';
    if (!email || !password) {
      errorMsg = 'Email et mot de passe requis.';
      return;
    }
    loading = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      goto('/dashboard');
    } catch (e) {
      errorMsg = 'Email ou mot de passe invalide.';
    }
    loading = false;
  }

  async function loginGoogle() {
    errorMsg = '';
    loading = true;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      goto('/dashboard');
    } catch {
      errorMsg = 'Erreur lors de la connexion Google.';
    }
    loading = false;
  }
</script>

<style>
  main {
    max-width: 360px;
    margin: 4rem auto;
    background: #12141c;
    padding: 2.5rem;
    border-radius: 12px;
    box-shadow: 0 0 24px #1f2430cc;
    color: #cfd2d6;
    font-family: 'Poppins', sans-serif;
  }
  h1 {
    text-align: center;
    font-weight: 700;
    font-size: 1.8rem;
    margin-bottom: 2rem;
    color: #5a7fa8;
    text-shadow: 0 0 8px #5477b9;
  }
  .tabs {
    display: flex;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #2e3348;
  }
  .tab {
    flex: 1;
    text-align: center;
    padding: 0.75rem 0;
    cursor: pointer;
    font-weight: 600;
    color: #7a7f91;
    user-select: none;
  }
  .tab.active {
    color: #aabedc;
    border-bottom: 3px solid #5a7fa8;
  }
  label {
    display: block;
    margin-bottom: 0.3rem;
    font-size: 0.9rem;
    color: #a0a5b8;
  }
  input {
    width: 100%;
    padding: 0.6rem 0.8rem;
    margin-bottom: 1.2rem;
    border-radius: 6px;
    border: none;
    background: #1f2430;
    color: #cfd2d6;
    font-size: 1rem;
  }
  input:focus {
    outline: 2px solid #5a7fa8;
    background: #29303e;
  }
  button {
    width: 100%;
    padding: 0.75rem 0;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s ease;
    font-size: 1.1rem;
    margin-top: 0.5rem;
  }
  button.email-btn {
    background: #5a7fa8;
    color: #fff;
  }
  button.email-btn:hover {
    background: #446597;
  }
  button.google-btn {
    background: #4285f4;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    font-weight: 700;
  }
  button.google-btn:hover {
    background: #3367d6;
  }
  .error-msg {
    background: #ff4c4c;
    padding: 0.8rem;
    border-radius: 6px;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #fff;
    text-align: center;
    user-select: none;
  }
  .loading {
    text-align: center;
    margin-top: 1rem;
    color: #5a7fa8;
    font-weight: 600;
  }
  .google-icon {
    width: 20px;
    height: 20px;
    filter: drop-shadow(0 0 1px #000);
  }
</style>

<main>
  <h1>Node Battle</h1>

  <div class="tabs">
    <div class="tab" class:active={tab === 'email'} on:click={() => (tab = 'email')}>Email & Mot de passe</div>
    <div class="tab" class:active={tab === 'google'} on:click={() => (tab = 'google')}>Google</div>
  </div>

  {#if errorMsg}
    <div class="error-msg">{errorMsg}</div>
  {/if}

  {#if tab === 'email'}
    <label for="email">Adresse email</label>
    <input
      id="email"
      type="email"
      placeholder="ton@email.com"
      bind:value={email}
      autocomplete="username"
      required
      disabled={loading}
    />

    <label for="password">Mot de passe</label>
    <input
      id="password"
      type="password"
      placeholder="Mot de passe"
      bind:value={password}
      autocomplete="current-password"
      required
      disabled={loading}
    />

    <button class="email-btn" on:click={loginEmail} disabled={loading}>
      {loading ? 'Connexion...' : 'Se connecter'}
    </button>

    <p style="margin-top: 1rem; text-align:center; font-size: 0.9rem; color:#888;">
      Pas encore de compte ?
      <a href="/register" style="color:#5a7fa8; cursor:pointer;">S'inscrire</a>
    </p>
  {:else}
    <button class="google-btn" on:click={loginGoogle} disabled={loading}>
      <!-- icône Google ici (même que précédemment) -->
      Se connecter avec Google
    </button>
  {/if}

  {#if loading}
    <div class="loading">Connexion en cours…</div>
  {/if}
</main>
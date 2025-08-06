<script lang="ts">
  import { auth } from '$lib/firebase';
  import { createUserWithEmailAndPassword } from 'firebase/auth';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let errorMsg = '';
  let loading = false;

  async function register() {
    errorMsg = '';
    if (!email || !password || !confirmPassword) {
      errorMsg = 'Tous les champs sont requis.';
      return;
    }
    if (password !== confirmPassword) {
      errorMsg = 'Les mots de passe ne correspondent pas.';
      return;
    }
    loading = true;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      goto('/dashboard');
    } catch (e: any) {
      errorMsg = e.message || 'Erreur lors de l\'inscription.';
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
    background: #5a7fa8;
    color: #fff;
  }
  button:hover {
    background: #446597;
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
  p.info {
    text-align: center;
    font-size: 0.9rem;
    color: #888;
    margin-top: 1rem;
  }
  p.info a {
    color: #5a7fa8;
    cursor: pointer;
  }
</style>

<main>
  <h1>Créer un compte</h1>

  {#if errorMsg}
    <div class="error-msg">{errorMsg}</div>
  {/if}

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
    autocomplete="new-password"
    required
    disabled={loading}
  />

  <label for="confirmPassword">Confirmer mot de passe</label>
  <input
    id="confirmPassword"
    type="password"
    placeholder="Confirme ton mot de passe"
    bind:value={confirmPassword}
    autocomplete="new-password"
    required
    disabled={loading}
  />

  <button on:click={register} disabled={loading}>
    {loading ? 'Inscription en cours...' : 'Créer mon compte'}
  </button>

  <p class="info">
    Déjà un compte ?
    <a href="/login">Se connecter</a>
  </p>
</main>

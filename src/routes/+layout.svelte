<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body) {
    width: 100%; height: 100%;
    /* War table surface — very dark, slight warm-dark-green undertone */
    background:
      radial-gradient(ellipse at 50% 42%, #071208 0%, #030805 55%, #010302 100%);
    font-family: 'Courier New', Courier, monospace;
    user-select: none;
    overflow: hidden;
  }
</style>

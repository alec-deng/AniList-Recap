module.exports = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'apollo': ['@apollo/client']
        }
      }
    }
  }
}
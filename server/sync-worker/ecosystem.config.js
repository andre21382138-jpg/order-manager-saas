module.exports = {
  apps: [
    {
      name: 'sync-worker',
      script: './worker.js',
      cwd: '/root/sync-worker',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
      error_file: './sync-worker.err.log',
      out_file: './sync-worker.out.log',
      time: true,
    },
    {
      name: 'validate-proxy',
      script: './validate-server.js',
      cwd: '/root/sync-worker',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: { NODE_ENV: 'production' },
      error_file: './validate-proxy.err.log',
      out_file: './validate-proxy.out.log',
      time: true,
    },
  ],
}

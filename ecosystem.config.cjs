module.exports = {
  apps: [
    {
      name: 'tempopoint',
      cwd: __dirname,
      script: './backend/dist/server.js',
      interpreter: process.execPath,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
  ],
};

// CommonJS keeps this PM2 configuration compatible with the ESM application.
module.exports = {
  apps: [
    {
      name: 'connect981-api',
      // Resolve the application and env file from the repository, regardless of the shell's cwd.
      cwd: `${__dirname}/..`,
      script: 'apps/api/dist/src/server.js',
      interpreter: process.execPath,
      node_args: ['--env-file=deployment/.env'],
      // Demo authentication stores sessions in memory, so run one process only.
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      exp_backoff_restart_delay: 1000,
      // Drain HTTP requests, disconnect Mongoose, and stop temporary MongoDB on SIGINT.
      kill_timeout: 10000,
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};

const Service = require('node-windows').Service;
const path = require('path');

// Define the service
const svc = new Service({
  name: 'TEC POS',
  description: 'Node.js backend for MERN POS system.',
  script: path.join(__dirname, 'app.js'), // change to your main server file
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  wait: 2,
  grow: 0.5,
  maxRetries: 40,
});

// Listen for install event
svc.on('install', () => {
  console.log('Service installed');
  svc.start();
});

// Listen for already installed
svc.on('alreadyinstalled', () => {
  console.log('Service already installed');
});

// Install the service
svc.install();